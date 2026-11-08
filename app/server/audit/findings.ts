/**
 * Building findings: stable fingerprints, period labels, severities and the
 * evidence references that let the UI show both halves of every claim.
 */

import { createHash } from "node:crypto";

import { periodLabel } from "./dates";
import type { ResolvedTerm } from "./terms";
import type { CheckCode, EvidenceRefs, Finding, FindingMath, Severity } from "./types";

const SEVERITY: Record<CheckCode, Severity> = {
  DUPLICATE_BILLING: "breach",
  SEAT_CAP_EXCEEDED: "verify",
  PRICE_ABOVE_CONTRACT: "breach",
  USAGE_OVERBILLED: "breach",
  RATE_ABOVE_CONTRACT: "breach",
  RENEWAL_NOTICE_DEADLINE: "deadline",
};

/** Collects the records a finding rests on, in order, without repeats. */
export class Evidence {
  private readonly invoices = new Set<string>();
  private readonly lines = new Set<string>();
  private readonly terms = new Set<string>();
  private readonly usageTotals = new Set<string>();
  private readonly rules = new Set<string>();

  invoice(...ids: string[]): this {
    ids.forEach((id) => this.invoices.add(id));
    return this;
  }

  line(...ids: string[]): this {
    ids.forEach((id) => this.lines.add(id));
    return this;
  }

  /** Cites a resolved term, filing it under rules when a rule supplied it. */
  term(...resolved: Array<ResolvedTerm | null | undefined>): this {
    for (const term of resolved) {
      if (term) (term.fromRule ? this.rules : this.terms).add(term.id);
    }
    return this;
  }

  usage(...ids: string[]): this {
    ids.forEach((id) => this.usageTotals.add(id));
    return this;
  }

  toRefs(): EvidenceRefs {
    return {
      invoiceIds: [...this.invoices],
      lineIds: [...this.lines],
      termIds: [...this.terms],
      usageTotalIds: [...this.usageTotals],
      ruleIds: [...this.rules],
    };
  }
}

export interface FindingSpec {
  check: CheckCode;
  title: string;
  explanation: string;
  amountCents: number;
  atRiskCents?: number;
  periodStart: string;
  periodEnd: string;
  invoiceNumber?: string | null;
  meter?: string | null;
  deadline?: string | null;
  math: FindingMath;
  evidence: Evidence;
}

/**
 * Identifies "the same finding" across re-runs so accepted/rejected status
 * survives: vendor, check, period, meter and invoice — never the amount, which
 * rules are allowed to change.
 */
export const fingerprint = (
  vendorId: string,
  check: CheckCode,
  periodStart: string,
  meter: string | null,
  invoiceNumber: string | null,
): string =>
  createHash("sha1")
    .update([vendorId, check, periodStart, meter ?? "", invoiceNumber ?? ""].join("\u001f"))
    .digest("hex");

export const buildFinding = (vendorId: string, spec: FindingSpec): Finding => {
  const meter = spec.meter ?? null;
  const invoiceNumber = spec.invoiceNumber ?? null;
  return {
    fingerprint: fingerprint(vendorId, spec.check, spec.periodStart, meter, invoiceNumber),
    vendorId,
    check: spec.check,
    severity: SEVERITY[spec.check],
    title: spec.title,
    explanation: spec.explanation,
    amountCents: spec.amountCents,
    atRiskCents: spec.atRiskCents ?? 0,
    periodStart: spec.periodStart,
    periodEnd: spec.periodEnd,
    periodLabel: periodLabel(spec.periodStart, spec.periodEnd),
    invoiceNumber,
    meter,
    deadline: spec.deadline ?? null,
    math: spec.math,
    refs: spec.evidence.toRefs(),
  };
};
