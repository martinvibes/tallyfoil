/**
 * Display strings for engine values, produced by code so that every number
 * on screen comes from the same arithmetic the audit used.
 */

import { formatLongDate } from "../audit/dates.js";
import { formatCount, formatUsdMicros } from "../audit/money.js";
import type { CheckCode, TermKey } from "../audit/types.js";

export interface TermValue {
  key: TermKey;
  valueNum: number | null;
  valueText: string | null;
  valueDate: string | null;
}

export const TERM_LABELS: Record<TermKey, string> = {
  seat_price: "Seat price",
  seat_cap: "Seat cap",
  renewal_uplift_cap_bps: "Renewal increase cap",
  term_start: "Term starts",
  term_end: "Term ends",
  auto_renew: "Auto-renews",
  notice_days: "Notice period",
  meter_rate: "Rate",
  billing_basis: "Billing basis",
};

export const CHECK_LABELS: Record<CheckCode, string> = {
  DUPLICATE_BILLING: "Billed twice",
  SEAT_CAP_EXCEEDED: "Seats over the cap",
  PRICE_ABOVE_CONTRACT: "Price above contract",
  USAGE_OVERBILLED: "Usage that never happened",
  RATE_ABOVE_CONTRACT: "Rate above contract",
  RENEWAL_NOTICE_DEADLINE: "Renewal notice deadline",
};

export const formatTermValue = ({ key, valueNum, valueText, valueDate }: TermValue): string => {
  switch (key) {
    case "seat_price":
      return valueNum == null ? "—" : `${formatUsdMicros(valueNum)} per seat / month`;
    case "meter_rate":
      return valueNum == null ? "—" : `${formatUsdMicros(valueNum)} per 1M tokens`;
    case "seat_cap":
      return valueNum == null ? "—" : `${formatCount(valueNum)} seats`;
    case "renewal_uplift_cap_bps":
      return valueNum == null ? "—" : `${valueNum / 100}% per renewal`;
    case "notice_days":
      return valueNum == null ? "—" : `${formatCount(valueNum)} days`;
    case "auto_renew":
      return valueNum === 1 ? "Yes" : "No";
    case "term_start":
    case "term_end":
      return valueDate ? formatLongDate(valueDate) : "—";
    case "billing_basis":
      return valueText === "usage_export" ? "Usage dashboard export" : (valueText ?? "—");
  }
};
