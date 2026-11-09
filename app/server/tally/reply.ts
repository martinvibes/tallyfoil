import { findMoneyTokens } from "../audit/number-guard.js";

export type ReplyOutcome = "credited" | "refused";
export type ReplyStatus = "credited" | "partially_credited" | "refused";

export type CreditReading =
  | { ok: true; status: ReplyStatus; recoveredCents: number }
  | { ok: false; errorCode: "value_not_in_quote" | "credit_exceeds_dispute"; message: string };

/**
 * Read what the vendor conceded from their own words. The amount is parsed
 * from the quoted reply line by code: the agent picks the line, never the number.
 * When a line names several amounts ("of the $3,066.24 you raised we accept
 * $1,601.28"), the credit is the largest one that fits inside the dispute.
 */
export const readCredit = (outcome: ReplyOutcome, quotes: readonly string[], disputedCents: number): CreditReading => {
  if (outcome === "refused") return { ok: true, status: "refused", recoveredCents: 0 };

  const amounts = quotes.flatMap((quote) => findMoneyTokens(quote).map((token) => token.cents));
  if (amounts.length === 0) {
    return { ok: false, errorCode: "value_not_in_quote", message: "Quote the reply line that states the credit amount." };
  }
  const fitting = amounts.filter((cents) => cents <= disputedCents);
  if (fitting.length === 0) {
    return {
      ok: false,
      errorCode: "credit_exceeds_dispute",
      message: "Every amount in the quoted line is larger than the dispute. Quote the line that states what they credited for this dispute.",
    };
  }
  const recoveredCents = Math.max(...fitting);
  return { ok: true, status: recoveredCents === disputedCents ? "credited" : "partially_credited", recoveredCents };
};
