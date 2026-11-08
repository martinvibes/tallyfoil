/**
 * Converts the human-readable values the agent reads off a contract
 * ("USD 24.00", "5%", "January 31, 2026", "yes") into engine units, and says
 * what the evidence quotes must contain for the value to count as grounded.
 */

import { findDatesInText } from "../audit/dates.js";
import type { ClaimedValue } from "../audit/evidence.js";
import { decimalToMicros, usdToMicros } from "../audit/money.js";
import type { TermKey } from "../audit/types.js";

export type RawValue = string | number | boolean;

export interface ParsedTermValue {
  valueNum: number | null;
  valueText: string | null;
  valueDate: string | null;
  claim: ClaimedValue;
}

export type ParseResult = { ok: true; value: ParsedTermValue } | { ok: false; message: string };

const MICROS_PER_PERCENT = 10_000n;
const PERCENT_SIGN = /\s*(?:%|percent|per cent)\s*$/i;
const TRUE_WORDS = new Set(["1", "true", "yes", "y", "on", "auto"]);
const FALSE_WORDS = new Set(["0", "false", "no", "n", "off", "none"]);

const ok = (value: Partial<ParsedTermValue> & { claim: ClaimedValue }): ParseResult => ({
  ok: true,
  value: { valueNum: null, valueText: null, valueDate: null, ...value },
});

const invalid = (message: string): ParseResult => ({ ok: false, message });

const asText = (raw: RawValue) => String(raw).trim();

const parseMicros = (raw: RawValue, label: string): ParseResult => {
  try {
    const micros = usdToMicros(asText(raw));
    if (micros < 0) return invalid(`${label} cannot be negative.`);
    return ok({ valueNum: micros, claim: { kind: "decimal", micros } });
  } catch {
    return invalid(`${label} must be a USD amount like "24.00"; got "${asText(raw)}".`);
  }
};

const parseWholeNumber = (raw: RawValue, label: string): ParseResult => {
  const text = asText(raw).replace(/,/g, "");
  if (!/^\d+$/.test(text)) return invalid(`${label} must be a whole number; got "${asText(raw)}".`);
  const value = Number(text);
  return ok({ valueNum: value, claim: { kind: "integer", value } });
};

/** "5%" and 5 mean five percent; a bare number above 100 is already basis points. */
const parsePercent = (raw: RawValue): ParseResult => {
  const text = asText(raw);
  const hasSign = PERCENT_SIGN.test(text);
  try {
    const micros = decimalToMicros(text.replace(PERCENT_SIGN, ""));
    if (micros < 0n) return invalid("A percentage cannot be negative.");
    const asPercent = hasSign || micros <= 100n * 1_000_000n;
    const bps = asPercent ? Number(micros / MICROS_PER_PERCENT) : Number(micros / 1_000_000n);
    return ok({ valueNum: bps, claim: { kind: "percent", bps } });
  } catch {
    return invalid(`Give the cap as a percentage like "5%"; got "${text}".`);
  }
};

const parseDate = (raw: RawValue): ParseResult => {
  const dates = findDatesInText(asText(raw));
  if (dates.length !== 1 || !dates[0]) return invalid(`Give one date, e.g. "2026-01-31"; got "${asText(raw)}".`);
  return ok({ valueDate: dates[0], claim: { kind: "date", iso: dates[0] } });
};

const parseFlag = (raw: RawValue): ParseResult => {
  const word = asText(raw).toLowerCase();
  if (TRUE_WORDS.has(word)) return ok({ valueNum: 1, claim: { kind: "presence" } });
  if (FALSE_WORDS.has(word)) return ok({ valueNum: 0, claim: { kind: "presence" } });
  return invalid(`auto_renew must be yes or no; got "${asText(raw)}".`);
};

export const parseTermValue = (key: TermKey, raw: RawValue): ParseResult => {
  switch (key) {
    case "seat_price":
      return parseMicros(raw, "seat_price");
    case "meter_rate":
      return parseMicros(raw, "meter_rate");
    case "seat_cap":
      return parseWholeNumber(raw, "seat_cap");
    case "notice_days":
      return parseWholeNumber(raw, "notice_days");
    case "renewal_uplift_cap_bps":
      return parsePercent(raw);
    case "term_start":
    case "term_end":
      return parseDate(raw);
    case "auto_renew":
      return parseFlag(raw);
    case "billing_basis": {
      const text = asText(raw);
      return text ? ok({ valueText: text, claim: { kind: "presence" } }) : invalid("billing_basis cannot be empty.");
    }
  }
};
