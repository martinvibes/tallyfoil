/**
 * Client helpers for Tallyfoil screens. Amounts are formatted by the same
 * code the audit engine uses, so screen and engine can never disagree.
 */

export { formatUsd } from "../../server/audit/money";
export type { DocumentView, FindingDetail, Overview, VendorDetail } from "../../server/tally/views";
export type { CheckCode } from "../../server/audit/types";
export type { DisputeView } from "../../server/tally/disputes";
export { findMoneyTokens } from "../../server/audit/number-guard";

/** "1,255 dollars 68 cents" — what a screen reader says for an amount. */
export const spokenUsd = (cents: number): string => {
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100).toLocaleString("en-US");
  const rest = abs % 100;
  return `${cents < 0 ? "minus " : ""}${dollars} dollars${rest ? ` ${rest} cents` : ""}`;
};

/** Database timestamps come back without a zone and are UTC. */
const parseTimestamp = (value: string): Date => {
  const hasZone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value);
  return new Date(hasZone ? value : `${value.replace(" ", "T")}Z`);
};

export const relativeTime = (iso: string | null): string => {
  if (!iso) return "never";
  const seconds = Math.round((Date.now() - parseTimestamp(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return parseTimestamp(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
