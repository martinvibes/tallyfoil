/**
 * Engine input and output types. Units are fixed everywhere:
 * money in integer cents, unit prices in integer micro-dollars,
 * token rates in micro-dollars per 1M tokens, percentages in basis points,
 * dates as ISO `YYYY-MM-DD` strings.
 */

export type VendorKind = "seat_subscription" | "usage_metered";

export type TermKey =
  | "seat_price"
  | "seat_cap"
  | "renewal_uplift_cap_bps"
  | "term_start"
  | "term_end"
  | "auto_renew"
  | "notice_days"
  | "meter_rate"
  | "billing_basis";

export type TermSource = "agent" | "user" | "rule";

export interface TermInput {
  id: string;
  key: TermKey;
  meter?: string | null;
  valueNum?: number | null;
  valueText?: string | null;
  valueDate?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  source?: TermSource;
}

export interface InvoiceLineInput {
  id: string;
  description: string;
  meter?: string | null;
  quantity: number;
  unitPriceMicros: number;
  amountCents: number;
}

export interface InvoiceInput {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  lines: InvoiceLineInput[];
}

export interface UsageTotalInput {
  id: string;
  meter: string;
  periodStart: string;
  periodEnd: string;
  quantity: number;
}

export type CheckCode =
  | "DUPLICATE_BILLING"
  | "SEAT_CAP_EXCEEDED"
  | "PRICE_ABOVE_CONTRACT"
  | "USAGE_OVERBILLED"
  | "RATE_ABOVE_CONTRACT"
  | "RENEWAL_NOTICE_DEADLINE";

export const CHECK_CODES: readonly CheckCode[] = [
  "DUPLICATE_BILLING",
  "SEAT_CAP_EXCEEDED",
  "PRICE_ABOVE_CONTRACT",
  "USAGE_OVERBILLED",
  "RATE_ABOVE_CONTRACT",
  "RENEWAL_NOTICE_DEADLINE",
];

export type Severity = "breach" | "verify" | "deadline";

export interface OverrideTermRule {
  id: string;
  type: "override_term";
  payload: {
    key: TermKey;
    /** Engine units: number for numeric keys, ISO string for date keys, text otherwise. */
    value: number | string;
    meter?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  };
}

export interface WaiveCheckRule {
  id: string;
  type: "waive_check";
  payload: {
    check: CheckCode;
    periodFrom?: string | null;
    periodTo?: string | null;
    meter?: string | null;
  };
}

export type RuleInput = OverrideTermRule | WaiveCheckRule;

export interface VendorInput {
  id: string;
  name: string;
  kind: VendorKind;
}

export interface AuditInput {
  vendor: VendorInput;
  terms: TermInput[];
  rules: RuleInput[];
  invoices: InvoiceInput[];
  usageTotals: UsageTotalInput[];
}

/** Ids of the records a finding rests on, so the UI can show both halves. */
export interface EvidenceRefs {
  invoiceIds: string[];
  lineIds: string[];
  termIds: string[];
  usageTotalIds: string[];
  ruleIds: string[];
}

export type FindingMath = { formula: string; result: string } & Record<string, string | number>;

export interface Finding {
  fingerprint: string;
  vendorId: string;
  check: CheckCode;
  severity: Severity;
  title: string;
  explanation: string;
  amountCents: number;
  atRiskCents: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  invoiceNumber: string | null;
  meter: string | null;
  deadline: string | null;
  math: FindingMath;
  refs: EvidenceRefs;
}

/** A finding the rules removed: present without rules, absent with them. */
export interface ExplainedFinding {
  fingerprint: string;
  check: CheckCode;
  periodLabel: string;
  amountCents: number;
  ruleIds: string[];
}

export interface AuditTotals {
  recoverableCents: number;
  atRiskCents: number;
  findingCount: number;
  byCheckCents: Partial<Record<CheckCode, number>>;
}

export interface AuditOutput {
  engineVersion: string;
  findings: Finding[];
  explained: ExplainedFinding[];
  totals: AuditTotals;
}
