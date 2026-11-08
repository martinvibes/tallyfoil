/**
 * The number guard: every dollar amount the agent writes into dispute prose
 * must equal, to the cent, an amount the engine computed. The agent may
 * phrase the email however it likes; it may not invent money.
 */

import { centsFromMicros, decimalToMicros } from "./money";

export interface MoneyToken {
  /** The amount exactly as written, e.g. "$1,255.68" or "40 USD". */
  text: string;
  cents: number;
  /** Offset of `text` in the checked string. */
  index: number;
}

export interface AmountCheck {
  ok: boolean;
  offending: MoneyToken[];
}

const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const SCALE = String.raw`(?:([km])(?![a-z])|\s(thousand|million)\b)?`;

/** "$12", "US$3", "USD 12", "$5k", "$1.2 million". */
const PREFIXED = String.raw`(?<![a-z])(?:us\$|\$|usd)\s?(${NUMBER})${SCALE}`;
/** "40 USD", "12.50 dollars". */
const SUFFIXED = String.raw`(?<![\d.,])(${NUMBER})\s?(?:usd|dollars?)\b`;

const MONEY = new RegExp(`${PREFIXED}|${SUFFIXED}`, "gi");

const MULTIPLIERS: Record<string, bigint> = { k: 1_000n, thousand: 1_000n, m: 1_000_000n, million: 1_000_000n };

const toCents = (amount: string, scale: string | undefined): number => {
  const micros = decimalToMicros(amount);
  return centsFromMicros(micros * (scale ? MULTIPLIERS[scale.toLowerCase()] : 1n));
};

/** Every money-looking token in `text`, in reading order. Bare numbers are not money. */
export const findMoneyTokens = (text: string): MoneyToken[] =>
  [...text.matchAll(MONEY)].map((match) => {
    const [whole, prefixedAmount, shortScale, wordScale, suffixedAmount] = match;
    return {
      text: whole,
      cents: toCents(prefixedAmount ?? suffixedAmount, shortScale ?? wordScale),
      index: match.index,
    };
  });

/** Passes only if every amount in `text` is one of `allowedCents`. */
export const checkAmounts = (text: string, allowedCents: readonly number[]): AmountCheck => {
  const allowed = new Set(allowedCents);
  const offending = findMoneyTokens(text).filter((token) => !allowed.has(token.cents));
  return { ok: offending.length === 0, offending };
};
