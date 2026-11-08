/**
 * The evidence matcher: every value the agent records must be backed by
 * 1–3 quotes that exist in the source document, and the value itself must
 * appear in at least one of them. Matching tolerates the noise PDF text
 * extraction introduces (case, whitespace, curly quotes, dashes) and maps
 * matches back to offsets in the original text for highlighting.
 */

import { findDatesInText } from "./dates";
import { decimalToMicros } from "./money";

export type ClaimedValue =
  | { kind: "money"; cents: number }
  | { kind: "decimal"; micros: number }
  | { kind: "integer"; value: number }
  | { kind: "percent"; bps: number }
  | { kind: "date"; iso: string }
  | { kind: "presence" };

export interface FragmentInput {
  quote: string;
}

export interface MatchedFragment {
  /** The exact text of the document at `start..end`. */
  quote: string;
  start: number;
  end: number;
}

export type EvidenceErrorCode = "evidence_not_found" | "value_not_in_quote" | "invalid_fragments";

export type EvidenceResult =
  | { ok: true; fragments: MatchedFragment[] }
  | { ok: false; errorCode: EvidenceErrorCode; message: string; quote?: string };

export const MAX_FRAGMENTS = 3;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const SINGLE_QUOTES = new Set(["‘", "’", "‚", "ʼ", "′", "`"]);
const DOUBLE_QUOTES = new Set(["“", "”", "„", "″"]);
const DASHES = new Set(["‐", "‑", "‒", "–", "—", "−"]);
const LINE_NUMBER_PREFIX = /^\s*\d+\s*[|│]\s?/;

interface Normalized {
  text: string;
  /** `offsets[i]` is the index in the original text of normalized char `i`. */
  offsets: number[];
}

const canonicalChar = (char: string): string => {
  if (SINGLE_QUOTES.has(char)) return "'";
  if (DOUBLE_QUOTES.has(char)) return '"';
  if (DASHES.has(char)) return "-";
  return char.toLowerCase();
};

const normalize = (input: string): Normalized => {
  let text = "";
  const offsets: number[] = [];

  for (let i = 0; i < input.length; i++) {
    const char = input.charAt(i);
    if (/\s/.test(char)) {
      // Collapse whitespace runs, drop leading whitespace and the gap in "$ 12".
      if (text.length === 0 || text.endsWith(" ") || text.endsWith("$")) continue;
      text += " ";
      offsets.push(i);
      continue;
    }
    for (const out of canonicalChar(char)) {
      text += out;
      offsets.push(i);
    }
  }

  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    offsets.pop();
  }
  return { text, offsets };
};

const normalizeQuote = (quote: string): string => normalize(quote.replace(LINE_NUMBER_PREFIX, "")).text;

// ---------------------------------------------------------------------------
// Locating quotes
// ---------------------------------------------------------------------------

/** Finds `quote` in `text` and returns its span in the original text, or null. */
export const locateQuote = (text: string, quote: string): { start: number; end: number } | null => {
  const needle = normalizeQuote(quote);
  if (!needle) return null;

  const haystack = normalize(text);
  const at = haystack.text.indexOf(needle);
  const start = haystack.offsets[at];
  const last = haystack.offsets[at + needle.length - 1];
  if (at < 0 || start === undefined || last === undefined) return null;

  return { start, end: last + 1 };
};

// ---------------------------------------------------------------------------
// Values inside quotes
// ---------------------------------------------------------------------------

const NUMBER = /(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
const PERCENT = /(\d+(?:\.\d+)?)\s?(?:%|percent\b|per cent\b)/g;
const WORD_PERCENT = /\b([a-z]+(?:-[a-z]+)?)\s(?:percent|per cent)\b/g;
const MILLIONS_MARKER = /\(m\)|\bmillions?\b|\bm tokens\b/;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, "twenty-five": 25, thirty: 30, forty: 40, fifty: 50,
  hundred: 100,
};

const numbersIn = (text: string): bigint[] =>
  [...text.matchAll(NUMBER)].map((m) => decimalToMicros(m[0]));

const percentsInBps = (text: string): number[] => [
  ...[...text.matchAll(PERCENT)].flatMap(([, digits]) => (digits ? [Number(decimalToMicros(digits) / 10_000n)] : [])),
  ...[...text.matchAll(WORD_PERCENT)].flatMap(([, word]) => {
    const value = word === undefined ? undefined : NUMBER_WORDS[word];
    return value === undefined ? [] : [value * 100];
  }),
];

const containsValue = (quote: string, value: ClaimedValue, documentSaysMillions: boolean): boolean => {
  switch (value.kind) {
    case "presence":
      return true;
    case "money":
      return numbersIn(quote).includes(BigInt(value.cents) * 10_000n);
    case "decimal":
      return numbersIn(quote).includes(BigInt(value.micros));
    case "integer": {
      const numbers = numbersIn(quote);
      const exact = BigInt(value.value) * 1_000_000n;
      // A count shown "in millions" reads 412 for 412,000,000: its micro-units equal the value.
      return numbers.includes(exact) || (documentSaysMillions && numbers.includes(BigInt(value.value)));
    }
    case "percent":
      return percentsInBps(quote).includes(value.bps);
    case "date":
      return findDatesInText(quote).includes(value.iso);
  }
};

export const describeValue = (value: ClaimedValue): string => {
  switch (value.kind) {
    case "presence":
      return "the quoted text";
    case "money":
      return `${(value.cents / 100).toFixed(2)} (money)`;
    case "decimal":
      return `${value.micros / 1_000_000} (decimal)`;
    case "integer":
      return `${value.value} (integer)`;
    case "percent":
      return `${value.bps / 100}% (percent)`;
    case "date":
      return `${value.iso} (date)`;
  }
};

// ---------------------------------------------------------------------------
// Matching a claimed value against its evidence
// ---------------------------------------------------------------------------

export const matchEvidence = (text: string, fragments: FragmentInput[], value: ClaimedValue): EvidenceResult => {
  if (fragments.length < 1 || fragments.length > MAX_FRAGMENTS) {
    return {
      ok: false,
      errorCode: "invalid_fragments",
      message: `Give between 1 and ${MAX_FRAGMENTS} quotes; got ${fragments.length}.`,
    };
  }

  const matched: MatchedFragment[] = [];
  for (const { quote } of fragments) {
    const span = locateQuote(text, quote);
    if (!span) {
      return {
        ok: false,
        errorCode: "evidence_not_found",
        message: `This quote is not in the document: "${quote}". Copy it exactly from read-document.`,
        quote,
      };
    }
    matched.push({ quote: text.slice(span.start, span.end), ...span });
  }

  const documentSaysMillions = MILLIONS_MARKER.test(normalize(text).text);
  const found = matched.some((fragment) => containsValue(normalize(fragment.quote).text, value, documentSaysMillions));
  if (!found) {
    return {
      ok: false,
      errorCode: "value_not_in_quote",
      message: `None of the quotes contains the value ${describeValue(value)}. Quote the text that states it.`,
    };
  }

  return { ok: true, fragments: matched };
};
