/**
 * Runs the deterministic engine over what is recorded in the database and
 * lands the result on the stored findings. This is the only writer of
 * finding amounts: every dollar in `findings` comes from `audit()`.
 */

import { and, asc, eq } from "drizzle-orm";

import { ENGINE_VERSION, audit } from "../audit/engine.js";
import { formatCents } from "../audit/money.js";
import type { AuditInput, Finding, RuleInput } from "../audit/types.js";
import { getDb, schema } from "../db/index.js";
import { type LedgerTotals, ledgerTotals } from "./ledger.js";
import { reconcileFindings } from "./reconcile.js";
import { type VendorRow, linesFor, ofVendor, requireVendor } from "./records.js";
import { newId, nowTimestamp, todayIso } from "./session.js";

export const loadAuditInput = async (owner: string, vendor: VendorRow): Promise<AuditInput> => {
  const db = getDb();
  const [terms, rules, invoices, usage] = await Promise.all([
    db.select().from(schema.terms).where(ofVendor(schema.terms, owner, vendor.id)),
    db
      .select()
      .from(schema.vendorRules)
      .where(and(ofVendor(schema.vendorRules, owner, vendor.id), eq(schema.vendorRules.active, true)))
      .orderBy(asc(schema.vendorRules.createdAt)),
    db.select().from(schema.invoices).where(ofVendor(schema.invoices, owner, vendor.id)),
    db.select().from(schema.usageTotals).where(ofVendor(schema.usageTotals, owner, vendor.id)),
  ]);
  const lines = await linesFor(
    owner,
    invoices.map((invoice) => invoice.id),
  );

  return {
    vendor: { id: vendor.id, name: vendor.name, kind: vendor.kind },
    terms: terms.map((term) => ({
      id: term.id,
      key: term.key,
      meter: term.meter,
      valueNum: term.valueNum,
      valueText: term.valueText,
      valueDate: term.valueDate,
      effectiveFrom: term.effectiveFrom,
      effectiveTo: term.effectiveTo,
      source: term.source,
    })),
    // Payloads are validated against the rule schema before they are stored.
    rules: rules.map((rule) => ({ id: rule.id, type: rule.type, payload: rule.payload }) as RuleInput),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      totalCents: invoice.totalCents,
      lines: lines
        .filter((line) => line.invoiceId === invoice.id)
        .map((line) => ({
          id: line.id,
          kind: line.kind,
          description: line.description,
          meter: line.meter,
          quantity: line.quantity,
          unitPriceMicros: line.unitPriceMicros,
          amountCents: line.amountCents,
        })),
    })),
    usageTotals: usage.map((total) => ({
      id: total.id,
      meter: total.meter,
      periodStart: total.periodStart,
      periodEnd: total.periodEnd,
      quantity: total.quantity,
    })),
  };
};

/** Ledger over the stored findings, for one vendor or all of them. */
export const storedLedger = async (owner: string, vendorId?: string): Promise<LedgerTotals> => {
  const rows = await getDb()
    .select({
      check: schema.findings.check,
      status: schema.findings.status,
      amountCents: schema.findings.amountCents,
      atRiskCents: schema.findings.atRiskCents,
    })
    .from(schema.findings)
    .where(vendorId ? ofVendor(schema.findings, owner, vendorId) : eq(schema.findings.ownerEmail, owner));
  return ledgerTotals(rows);
};

const findingFields = (finding: Finding) => ({
  check: finding.check,
  severity: finding.severity,
  title: finding.title,
  explanation: finding.explanation,
  amountCents: finding.amountCents,
  atRiskCents: finding.atRiskCents,
  periodStart: finding.periodStart,
  periodEnd: finding.periodEnd,
  periodLabel: finding.periodLabel,
  invoiceNumber: finding.invoiceNumber,
  meter: finding.meter,
  deadline: finding.deadline,
  math: finding.math,
  refs: finding.refs,
});

export interface VendorAuditSummary {
  vendorId: string;
  vendorName: string;
  findingCount: number;
  recoverableCents: number;
  atRiskCents: number;
  opened: number;
  resolved: number;
  /** Findings the vendor's rules account for, with the money they would have claimed. */
  explainedCount: number;
  explainedCents: number;
  /** Nothing to audit yet: no invoices recorded. */
  empty: boolean;
}

export interface AuditRunResult {
  runId: string;
  asOf: string;
  engineVersion: string;
  vendors: VendorAuditSummary[];
  before: LedgerTotals;
  after: LedgerTotals;
}

const auditVendor = async (owner: string, vendor: VendorRow, runId: string, asOf: string): Promise<VendorAuditSummary> => {
  const db = getDb();
  const input = await loadAuditInput(owner, vendor);
  const output = audit(input, asOf);

  const stored = await db
    .select({ id: schema.findings.id, fingerprint: schema.findings.fingerprint, status: schema.findings.status })
    .from(schema.findings)
    .where(ofVendor(schema.findings, owner, vendor.id));
  const plan = reconcileFindings(stored, output);
  const updatedAt = nowTimestamp();

  if (plan.insert.length > 0) {
    await db.insert(schema.findings).values(
      plan.insert.map((finding) => ({
        ...findingFields(finding),
        id: newId("fnd"),
        ownerEmail: owner,
        runId,
        vendorId: vendor.id,
        fingerprint: finding.fingerprint,
        status: "open" as const,
      })),
    );
  }
  for (const { id, finding, status } of plan.update) {
    await db
      .update(schema.findings)
      .set({ ...findingFields(finding), runId, status, explainedByRuleIds: null, updatedAt })
      .where(and(eq(schema.findings.ownerEmail, owner), eq(schema.findings.id, id)));
  }
  for (const { id, status, ruleIds } of plan.retire) {
    await db
      .update(schema.findings)
      .set({ status, explainedByRuleIds: ruleIds, updatedAt })
      .where(and(eq(schema.findings.ownerEmail, owner), eq(schema.findings.id, id)));
  }

  const ledger = await storedLedger(owner, vendor.id);
  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    findingCount: ledger.findingCount,
    recoverableCents: ledger.recoverableCents,
    atRiskCents: ledger.atRiskCents,
    opened: plan.opened,
    resolved: plan.resolved,
    explainedCount: output.explained.length,
    explainedCents: output.explained.reduce((sum, e) => sum + e.amountCents, 0),
    empty: input.invoices.length === 0,
  };
};

/** Audits one vendor, or every vendor the user has, and records the run. */
export const runAudit = async (owner: string, vendorId?: string): Promise<AuditRunResult> => {
  const vendors = vendorId
    ? [await requireVendor(owner, vendorId)]
    : await getDb()
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.ownerEmail, owner))
        .orderBy(asc(schema.vendors.createdAt));

  const before = await storedLedger(owner, vendorId);
  const asOf = todayIso();
  const runId = newId("run");

  const summaries: VendorAuditSummary[] = [];
  for (const vendor of vendors) summaries.push(await auditVendor(owner, vendor, runId, asOf));

  const after = await storedLedger(owner, vendorId);
  await getDb()
    .insert(schema.auditRuns)
    .values({
      id: runId,
      ownerEmail: owner,
      scope: vendorId ?? "all",
      engineVersion: ENGINE_VERSION,
      asOf,
      recoverableCents: after.recoverableCents,
      atRiskCents: after.atRiskCents,
      findingCount: after.findingCount,
    });

  return { runId, asOf, engineVersion: ENGINE_VERSION, vendors: summaries, before, after };
};

/** One plain sentence for chat: what changed and what stands. */
export const describeRun = (run: AuditRunResult): string => {
  const names = run.vendors.map((v) => v.vendorName).join(" and ") || "no vendors";
  const parts = [
    `Audited ${names}: ${run.after.findingCount} finding${run.after.findingCount === 1 ? "" : "s"}, ` +
      `${formatCents(run.after.recoverableCents)} recoverable, ${formatCents(run.after.atRiskCents)} at risk.`,
  ];
  if (run.before.recoverableCents !== run.after.recoverableCents) {
    parts.push(`Recoverable moved from ${formatCents(run.before.recoverableCents)} to ${formatCents(run.after.recoverableCents)}.`);
  }
  const explained = run.vendors.filter((v) => v.explainedCount > 0);
  for (const v of explained) {
    parts.push(`${v.vendorName}: your rules explain ${v.explainedCount} finding${v.explainedCount === 1 ? "" : "s"} (${formatCents(v.explainedCents)}).`);
  }
  const empty = run.vendors.filter((v) => v.empty).map((v) => v.vendorName);
  if (empty.length > 0) parts.push(`No bills recorded yet for ${empty.join(", ")}.`);
  return parts.join(" ");
};
