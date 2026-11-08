/**
 * Grounded recording: the agent proposes values read from a document; this
 * module accepts a value only if its quotes exist in the document and state
 * the value. Invoices must also be internally consistent (qty × price =
 * amount, lines sum to the total). Each item passes or fails on its own so
 * the agent can fix just the failures.
 */

import { findDatesInText, periodLabel } from "../audit/dates.js";
import { type ClaimedValue, type MatchedFragment, locateQuote, matchEvidence } from "../audit/evidence.js";
import { centsFromMicros, formatCents, parseUsd, tokenCostCents, usdToMicros } from "../audit/money.js";
import type { LineKind, TermKey } from "../audit/types.js";
import type { EvidenceJson } from "../db/schema.js";
import { type RawValue, parseTermValue } from "./term-values.js";

export interface TermItem {
  key: TermKey;
  meter?: string | null;
  value: RawValue;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  quotes: string[];
}

export interface LineItem {
  kind?: LineKind;
  description: string;
  meter?: string | null;
  quantity: number | string;
  unitPrice: RawValue;
  amount: RawValue;
  quotes: string[];
}

export interface InvoiceItem {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  total: RawValue;
  totalQuotes: string[];
  periodQuotes: string[];
  lines: LineItem[];
}

export interface GroundedTerm {
  key: TermKey;
  meter: string | null;
  valueNum: number | null;
  valueText: string | null;
  valueDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  evidence: EvidenceJson;
}

export interface GroundedLine {
  position: number;
  kind: LineKind;
  description: string;
  meter: string | null;
  quantity: number;
  unitPriceMicros: number;
  amountCents: number;
  evidence: EvidenceJson;
}

export interface GroundedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  evidence: EvidenceJson;
  lines: GroundedLine[];
}

export type ProblemCode =
  | "evidence_not_found"
  | "value_not_in_quote"
  | "invalid_fragments"
  | "invalid_value"
  | "missing_meter"
  | "line_math_mismatch"
  | "lines_do_not_sum";

export interface ItemProblem {
  index: number;
  item: string;
  errorCode: ProblemCode;
  message: string;
}

export interface Grounding<T> {
  grounded: Array<{ index: number; value: T }>;
  problems: ItemProblem[];
}

export interface SourceDocument {
  id: string;
  text: string;
}

/** Thrown inside one item's check; caught and reported against that item. */
class ItemFailure extends Error {
  constructor(
    readonly errorCode: ProblemCode,
    message: string,
  ) {
    super(message);
  }
}

const ROUNDING_TOLERANCE_CENTS = 1;

const ground = <I, T>(items: readonly I[], label: (item: I, index: number) => string, check: (item: I) => T): Grounding<T> => {
  const result: Grounding<T> = { grounded: [], problems: [] };
  items.forEach((item, index) => {
    try {
      result.grounded.push({ index, value: check(item) });
    } catch (error) {
      if (!(error instanceof ItemFailure)) throw error;
      result.problems.push({ index, item: label(item, index), errorCode: error.errorCode, message: error.message });
    }
  });
  return result;
};

const requireEvidence = (doc: SourceDocument, quotes: readonly string[], value: ClaimedValue, what: string): MatchedFragment[] => {
  const result = matchEvidence(
    doc.text,
    quotes.map((quote) => ({ quote })),
    value,
  );
  if (!result.ok) throw new ItemFailure(result.errorCode, `${what}: ${result.message}`);
  return result.fragments;
};

const evidenceOf = (doc: SourceDocument, ...fragmentLists: MatchedFragment[][]): EvidenceJson => {
  const seen = new Set<string>();
  const fragments = fragmentLists.flat().filter((f) => {
    const key = `${f.start}:${f.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { documentId: doc.id, fragments };
};

const parseIsoDate = (value: string | null | undefined, what: string): string | null => {
  if (!value) return null;
  const [iso] = findDatesInText(value);
  if (!iso || iso !== value.trim()) throw new ItemFailure("invalid_value", `${what} must be an ISO date like 2026-04-01; got "${value}".`);
  return iso;
};

const parseValue = <T>(parse: () => T, message: string): T => {
  try {
    return parse();
  } catch {
    throw new ItemFailure("invalid_value", message);
  }
};

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

const termLabel = (item: TermItem) => (item.meter ? `${item.key} (${item.meter})` : item.key);

export const groundTerms = (doc: SourceDocument, items: readonly TermItem[]): Grounding<GroundedTerm> =>
  ground(items, termLabel, (item) => {
    const meter = item.meter?.trim() || null;
    if (item.key === "meter_rate" && !meter) {
      throw new ItemFailure("missing_meter", 'meter_rate needs a meter such as "halcyon-small input".');
    }

    const parsed = parseTermValue(item.key, item.value);
    if (!parsed.ok) throw new ItemFailure("invalid_value", parsed.message);

    const fragments = requireEvidence(doc, item.quotes, parsed.value.claim, termLabel(item));
    return {
      key: item.key,
      meter: item.key === "meter_rate" ? meter : null,
      valueNum: parsed.value.valueNum,
      valueText: parsed.value.valueText,
      valueDate: parsed.value.valueDate,
      effectiveFrom: parseIsoDate(item.effectiveFrom, "effectiveFrom"),
      effectiveTo: parseIsoDate(item.effectiveTo, "effectiveTo"),
      evidence: evidenceOf(doc, fragments),
    };
  });

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const groundLine = (doc: SourceDocument, line: LineItem, position: number, invoiceNumber: string): GroundedLine => {
  const what = `${invoiceNumber} line ${position + 1}`;
  const meter = line.meter?.trim() || null;
  const kind: LineKind = line.kind ?? (meter ? "usage" : "seats");
  if (kind === "usage" && !meter) throw new ItemFailure("missing_meter", `${what}: usage lines need a meter like "halcyon-small input".`);

  const quantityText = String(line.quantity).replace(/,/g, "").trim();
  if (!/^-?\d+$/.test(quantityText)) {
    throw new ItemFailure("invalid_value", `${what}: quantity must be a whole number (full token count, not millions).`);
  }
  const quantity = Number(quantityText);
  const unitPriceMicros = parseValue(() => usdToMicros(String(line.unitPrice)), `${what}: unit price must be a USD amount.`);
  const amountCents = parseValue(() => parseUsd(String(line.amount)), `${what}: amount must be a USD amount.`);

  const fragments = [
    requireEvidence(doc, line.quotes, { kind: "integer", value: Math.abs(quantity) }, `${what} quantity`),
    requireEvidence(doc, line.quotes, { kind: "decimal", micros: Math.abs(unitPriceMicros) }, `${what} unit price`),
    requireEvidence(doc, line.quotes, { kind: "money", cents: Math.abs(amountCents) }, `${what} amount`),
  ];

  if (kind !== "other") {
    const computed = kind === "usage" ? tokenCostCents(quantity, unitPriceMicros) : centsFromMicros(BigInt(quantity) * BigInt(unitPriceMicros));
    if (Math.abs(computed - amountCents) > ROUNDING_TOLERANCE_CENTS) {
      const unit = kind === "usage" ? "per 1M tokens, quantity in tokens" : "per seat";
      throw new ItemFailure(
        "line_math_mismatch",
        `${what}: quantity × unit price (${unit}) is ${formatCents(computed)}, but the line says ${formatCents(amountCents)}. ` +
          `Give token counts in full (412 M → 412000000) or mark tax/fee/credit lines as kind "other".`,
      );
    }
  }

  return { position, kind, description: line.description.trim(), meter, quantity, unitPriceMicros, amountCents, evidence: evidenceOf(doc, ...fragments) };
};

/** The period counts as quoted when both dates appear, or the quote names the whole month ("October 2026"). */
const requirePeriod = (doc: SourceDocument, item: InvoiceItem): MatchedFragment[] => {
  const what = `${item.invoiceNumber} billing period`;
  const start = requireEvidence(doc, item.periodQuotes, { kind: "date", iso: item.periodStart }, what);
  const end = matchEvidence(doc.text, item.periodQuotes.map((quote) => ({ quote })), { kind: "date", iso: item.periodEnd });
  if (end.ok) return start;
  throw new ItemFailure("value_not_in_quote", `${what}: the quotes must show ${item.periodStart} and ${item.periodEnd}.`);
};

const requireMonthOrPeriod = (doc: SourceDocument, item: InvoiceItem): MatchedFragment[] => {
  const label = periodLabel(item.periodStart, item.periodEnd).toLowerCase();
  const wholeMonth = !label.includes("–");
  if (wholeMonth) {
    const located = item.periodQuotes.map((quote) => ({ quote, span: locateQuote(doc.text, quote) }));
    const named = located.find(({ span }) => span && doc.text.slice(span.start, span.end).toLowerCase().includes(label));
    if (named?.span) return [{ quote: doc.text.slice(named.span.start, named.span.end), ...named.span }];
  }
  return requirePeriod(doc, item);
};

export const groundInvoices = (doc: SourceDocument, items: readonly InvoiceItem[]): Grounding<GroundedInvoice> =>
  ground(
    items,
    (item) => `invoice ${item.invoiceNumber}`,
    (item) => {
      const invoiceNumber = item.invoiceNumber.trim();
      if (!locateQuote(doc.text, invoiceNumber)) {
        throw new ItemFailure("evidence_not_found", `Invoice number "${invoiceNumber}" is not in this document.`);
      }
      const invoiceDate = parseIsoDate(item.invoiceDate, "invoiceDate");
      if (!invoiceDate || !findDatesInText(doc.text).includes(invoiceDate)) {
        throw new ItemFailure("evidence_not_found", `${invoiceNumber}: invoice date ${item.invoiceDate} is not written in this document.`);
      }
      const periodStart = parseIsoDate(item.periodStart, "periodStart");
      const periodEnd = parseIsoDate(item.periodEnd, "periodEnd");
      if (!periodStart || !periodEnd || periodEnd < periodStart) {
        throw new ItemFailure("invalid_value", `${invoiceNumber}: give periodStart and periodEnd as ISO dates, start first.`);
      }

      const totalCents = parseValue(() => parseUsd(String(item.total)), `${invoiceNumber}: total must be a USD amount.`);
      const totalFragments = requireEvidence(doc, item.totalQuotes, { kind: "money", cents: Math.abs(totalCents) }, `${invoiceNumber} total`);
      const periodFragments = requireMonthOrPeriod(doc, { ...item, periodStart, periodEnd });

      if (item.lines.length === 0) throw new ItemFailure("invalid_value", `${invoiceNumber}: record at least one line.`);
      const lines = item.lines.map((line, position) => groundLine(doc, line, position, invoiceNumber));

      const linesTotal = lines.reduce((sum, line) => sum + line.amountCents, 0);
      if (Math.abs(linesTotal - totalCents) > ROUNDING_TOLERANCE_CENTS) {
        throw new ItemFailure(
          "lines_do_not_sum",
          `${invoiceNumber}: lines add up to ${formatCents(linesTotal)} but the total is ${formatCents(totalCents)}. ` +
            `Record every line, including tax and fees (kind "other").`,
        );
      }

      return {
        invoiceNumber,
        invoiceDate,
        periodStart,
        periodEnd,
        totalCents,
        evidence: evidenceOf(doc, totalFragments, periodFragments),
        lines,
      };
    },
  );
