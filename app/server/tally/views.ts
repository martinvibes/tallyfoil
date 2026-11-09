/**
 * Read models for the screens and the agent. Each view returns raw engine
 * units (cents, micros, ISO dates) for the UI plus display strings produced
 * by the same formatters the audit uses, so the agent can quote them as-is.
 */

import { and, desc, eq, inArray } from "drizzle-orm";

import { addMonths, endOfMonth, formatLongDate, periodLabel, startOfMonth } from "../audit/dates.js";
import { formatCount, formatUsd, formatUsdMicros } from "../audit/money.js";
import type { CheckCode, Severity } from "../audit/types.js";
import { getDb, schema } from "../db/index.js";
import type { EvidenceJson } from "../db/schema.js";
import { type Excerpt, excerpt } from "./excerpt.js";
import { CHECK_LABELS, TERM_LABELS, formatTermValue } from "./format.js";
import { type LedgerTotals, isDeadline, isStanding, ledgerTotals } from "./ledger.js";
import { listDisputes } from "./disputes.js";
import { linesFor, ofVendor, requireDocument, requireVendor } from "./records.js";

type FindingRow = typeof schema.findings.$inferSelect;
type RuleRow = typeof schema.vendorRules.$inferSelect;

const SEVERITY_ORDER: Severity[] = ["breach", "verify", "deadline"];

const withMoney = (totals: LedgerTotals) => ({
  ...totals,
  recoverable: formatUsd(totals.recoverableCents),
  atRisk: formatUsd(totals.atRiskCents),
});

const latestRuns = (owner: string) =>
  getDb()
    .select()
    .from(schema.auditRuns)
    .where(eq(schema.auditRuns.ownerEmail, owner))
    .orderBy(desc(schema.auditRuns.createdAt))
    .limit(50);

const lastAuditedAt = (runs: Array<{ scope: string; createdAt: string }>, vendorId: string) =>
  runs.find((run) => run.scope === "all" || run.scope === vendorId)?.createdAt ?? null;

const nextDeadline = (rows: readonly FindingRow[]) =>
  rows
    .filter((row) => isDeadline(row.check) && isStanding(row.status) && row.deadline)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
    .map((row) => ({
      findingId: row.id,
      vendorId: row.vendorId,
      deadline: row.deadline ?? "",
      deadlineLabel: formatLongDate(row.deadline ?? ""),
      atRiskCents: row.atRiskCents,
      atRisk: formatUsd(row.atRiskCents),
    }))[0] ?? null;

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export const getOverview = async (owner: string) => {
  const db = getDb();
  const [vendors, documents, invoices, terms, findings, runs, replies] = await Promise.all([
    db.select().from(schema.vendors).where(eq(schema.vendors.ownerEmail, owner)).orderBy(schema.vendors.createdAt),
    db
      .select({ vendorId: schema.documents.vendorId, status: schema.documents.status })
      .from(schema.documents)
      .where(eq(schema.documents.ownerEmail, owner)),
    db
      .select({
        vendorId: schema.invoices.vendorId,
        periodStart: schema.invoices.periodStart,
        totalCents: schema.invoices.totalCents,
        invoiceNumber: schema.invoices.invoiceNumber,
      })
      .from(schema.invoices)
      .where(eq(schema.invoices.ownerEmail, owner)),
    db.select({ vendorId: schema.terms.vendorId }).from(schema.terms).where(eq(schema.terms.ownerEmail, owner)),
    db.select().from(schema.findings).where(eq(schema.findings.ownerEmail, owner)),
    latestRuns(owner),
    db
      .select({ vendorId: schema.disputes.vendorId, recoveredCents: schema.disputes.recoveredCents })
      .from(schema.disputes)
      .where(eq(schema.disputes.ownerEmail, owner)),
  ]);
  const recoveredCents = replies.reduce((sum, row) => sum + (row.recoveredCents ?? 0), 0);

  const count = <T extends { vendorId: string }>(rows: readonly T[], vendorId: string, keep: (row: T) => boolean = () => true) =>
    rows.filter((row) => row.vendorId === vendorId && keep(row)).length;

  const vendorViews = vendors.map((vendor) => {
    const own = findings.filter((row) => row.vendorId === vendor.id);
    return {
      id: vendor.id,
      name: vendor.name,
      kind: vendor.kind,
      isSample: vendor.isSample,
      documentCount: count(documents, vendor.id),
      unreadDocumentCount: count(documents, vendor.id, (doc) => doc.status === "new"),
      invoiceCount: count(invoices, vendor.id),
      termCount: count(terms, vendor.id),
      totals: withMoney(ledgerTotals(own)),
      nextDeadline: nextDeadline(own),
      lastAuditedAt: lastAuditedAt(runs, vendor.id),
    };
  });

  const deadline = nextDeadline(findings);
  const latest = runs[0];
  return {
    totals: withMoney(ledgerTotals(findings)),
    /** What vendors have actually credited, read from their quoted replies. */
    recovered: { cents: recoveredCents, amount: formatUsd(recoveredCents), disputes: replies.filter((row) => (row.recoveredCents ?? 0) > 0).length },
    nextDeadline: deadline && { ...deadline, vendorName: vendors.find((v) => v.id === deadline.vendorId)?.name ?? "" },
    vendors: vendorViews,
    timeline: tallyTimeline(invoices, findings),
    latestRun: latest
      ? { id: latest.id, asOf: latest.asOf, createdAt: latest.createdAt, scope: latest.scope, engineVersion: latest.engineVersion }
      : null,
    hasSampleData: vendors.some((vendor) => vendor.isSample),
  };
};

// ---------------------------------------------------------------------------
// Vendor workspace
// ---------------------------------------------------------------------------

const quotesOf = (evidence: EvidenceJson | null, names: ReadonlyMap<string, string>) =>
  evidence
    ? {
        documentId: evidence.documentId,
        documentName: names.get(evidence.documentId) ?? "",
        quotes: evidence.fragments.map((fragment) => fragment.quote),
      }
    : null;

export const describeRule = (rule: Pick<RuleRow, "type" | "payload">): string => {
  const payload = rule.payload;
  if ("check" in payload) {
    const range = payload.periodFrom || payload.periodTo ? ` from ${payload.periodFrom ?? "the start"} to ${payload.periodTo ?? "now"}` : "";
    return `Don't flag "${CHECK_LABELS[payload.check]}"${payload.meter ? ` on ${payload.meter}` : ""}${range}.`;
  }
  const value = formatTermValue({
    key: payload.key,
    valueNum: typeof payload.value === "number" ? payload.value : null,
    valueText: typeof payload.value === "string" ? payload.value : null,
    valueDate: typeof payload.value === "string" ? payload.value : null,
  });
  const from = payload.effectiveFrom ? ` from ${formatLongDate(payload.effectiveFrom)}` : "";
  return `${TERM_LABELS[payload.key]}${payload.meter ? ` (${payload.meter})` : ""} is ${value}${from}.`;
};

const findingSummary = (row: FindingRow) => ({
  id: row.id,
  check: row.check,
  checkLabel: CHECK_LABELS[row.check],
  severity: row.severity,
  status: row.status,
  title: row.title,
  explanation: row.explanation,
  amountCents: row.amountCents,
  amount: formatUsd(row.amountCents),
  atRiskCents: row.atRiskCents,
  periodStart: row.periodStart,
  periodLabel: row.periodLabel,
  invoiceNumber: row.invoiceNumber,
  meter: row.meter,
  deadline: row.deadline,
  explainedByRuleIds: row.explainedByRuleIds ?? [],
  rejectReason: row.rejectReason,
});

/** One group per check, ordered breach → verify → deadline; the sample's 19 rows fold into 5 groups. */
const groupFindings = (rows: readonly FindingRow[]) => {
  const groups = new Map<CheckCode, FindingRow[]>();
  for (const row of rows) groups.set(row.check, [...(groups.get(row.check) ?? []), row]);
  return [...groups.entries()]
    .map(([check, members]) => {
      const sorted = [...members].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
      const standing = sorted.filter((row) => isStanding(row.status));
      const amountCents = standing.reduce((sum, row) => sum + (isDeadline(check) ? row.atRiskCents : row.amountCents), 0);
      return {
        check,
        label: CHECK_LABELS[check],
        severity: sorted[0]?.severity ?? "verify",
        count: sorted.length,
        standingCount: standing.length,
        amountCents,
        amount: formatUsd(amountCents),
        findingIds: sorted.map((row) => row.id),
      };
    })
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.amountCents - a.amountCents);
};

/**
 * One notch per billed month, from the first bill to the last. A month with
 * no bill is still listed (billedCents 0) so gaps in the record are visible.
 */
const tallyTimeline = (invoices: ReadonlyArray<{ periodStart: string; totalCents: number; invoiceNumber: string }>, findings: readonly FindingRow[]) => {
  const months = invoices.map((invoice) => startOfMonth(invoice.periodStart)).sort();
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) return [];

  const notches = [];
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    const billed = invoices.filter((invoice) => startOfMonth(invoice.periodStart) === month);
    const flagged = findings.filter(
      (row) => !isDeadline(row.check) && isStanding(row.status) && startOfMonth(row.periodStart) === month,
    );
    const overchargeCents = flagged.reduce((sum, row) => sum + row.amountCents, 0);
    notches.push({
      month: month.slice(0, 7),
      label: periodLabel(month, endOfMonth(month)),
      billedCents: billed.reduce((sum, invoice) => sum + invoice.totalCents, 0),
      overchargeCents,
      overcharge: formatUsd(overchargeCents),
      invoiceNumbers: billed.map((invoice) => invoice.invoiceNumber),
      findingIds: flagged.map((row) => row.id),
      /** The largest overcharge that month, for click-through. */
      topFinding: [...flagged].sort((a, b) => b.amountCents - a.amountCents).map((row) => ({ id: row.id, vendorId: row.vendorId, title: row.title }))[0] ?? null,
    });
  }
  return notches;
};

export const getVendorDetail = async (owner: string, vendorId: string) => {
  const db = getDb();
  const vendor = await requireVendor(owner, vendorId);
  const [documents, terms, rules, invoices, usage, findings, runs, disputes] = await Promise.all([
    db
      .select({
        id: schema.documents.id,
        kind: schema.documents.kind,
        name: schema.documents.name,
        status: schema.documents.status,
        isSample: schema.documents.isSample,
        createdAt: schema.documents.createdAt,
      })
      .from(schema.documents)
      .where(ofVendor(schema.documents, owner, vendorId))
      .orderBy(schema.documents.createdAt),
    db.select().from(schema.terms).where(ofVendor(schema.terms, owner, vendorId)),
    db.select().from(schema.vendorRules).where(ofVendor(schema.vendorRules, owner, vendorId)).orderBy(schema.vendorRules.createdAt),
    db.select().from(schema.invoices).where(ofVendor(schema.invoices, owner, vendorId)).orderBy(schema.invoices.periodStart, schema.invoices.invoiceDate),
    db.select().from(schema.usageTotals).where(ofVendor(schema.usageTotals, owner, vendorId)).orderBy(schema.usageTotals.meter, schema.usageTotals.periodStart),
    db.select().from(schema.findings).where(ofVendor(schema.findings, owner, vendorId)),
    latestRuns(owner),
    listDisputes(owner, vendorId),
  ]);
  const lines = await linesFor(
    owner,
    invoices.map((invoice) => invoice.id),
  );
  const documentNames = new Map(documents.map((doc) => [doc.id, doc.name]));
  const termOrder = Object.keys(TERM_LABELS);

  return {
    vendor: { id: vendor.id, name: vendor.name, kind: vendor.kind, isSample: vendor.isSample, createdAt: vendor.createdAt },
    totals: withMoney(ledgerTotals(findings)),
    nextDeadline: nextDeadline(findings),
    lastAuditedAt: lastAuditedAt(runs, vendorId),
    terms: [...terms]
      .sort((a, b) => termOrder.indexOf(a.key) - termOrder.indexOf(b.key) || (a.meter ?? "").localeCompare(b.meter ?? "") || (a.effectiveFrom ?? "").localeCompare(b.effectiveFrom ?? ""))
      .map((term) => ({
        id: term.id,
        key: term.key,
        label: TERM_LABELS[term.key],
        meter: term.meter,
        value: formatTermValue(term),
        valueNum: term.valueNum,
        valueText: term.valueText,
        valueDate: term.valueDate,
        effectiveFrom: term.effectiveFrom,
        effectiveTo: term.effectiveTo,
        source: term.source,
        revision: term.revision,
        evidence: quotesOf(term.evidence, documentNames),
      })),
    rules: rules.map((rule) => ({
      id: rule.id,
      type: rule.type,
      payload: rule.payload,
      description: describeRule(rule),
      reason: rule.reason,
      createdBy: rule.createdBy,
      active: rule.active,
      proof: quotesOf(rule.proof, documentNames),
      createdAt: rule.createdAt,
    })),
    documents,
    invoices: invoices.map((invoice) => {
      const own = lines.filter((line) => line.invoiceId === invoice.id);
      return {
        id: invoice.id,
        documentId: invoice.documentId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        periodLabel: periodLabel(invoice.periodStart, invoice.periodEnd),
        totalCents: invoice.totalCents,
        total: formatUsd(invoice.totalCents),
        lines: own.map((line) => ({
          id: line.id,
          kind: line.kind,
          description: line.description,
          meter: line.meter,
          quantity: line.quantity,
          unitPrice: formatUsdMicros(line.unitPriceMicros),
          amountCents: line.amountCents,
          amount: formatUsd(line.amountCents),
        })),
      };
    }),
    usage: usage.map((total) => ({
      id: total.id,
      documentId: total.documentId,
      meter: total.meter,
      periodLabel: periodLabel(total.periodStart, total.periodEnd),
      quantity: total.quantity,
      quantityLabel: formatCount(total.quantity),
    })),
    findingGroups: groupFindings(findings),
    findings: [...findings].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).map(findingSummary),
    timeline: tallyTimeline(invoices, findings),
    disputes: disputes.map((dispute) => ({ ...dispute, amount: formatUsd(dispute.amountCents) })),
  };
};

// ---------------------------------------------------------------------------
// Finding evidence (the two halves)
// ---------------------------------------------------------------------------

export interface EvidenceQuote extends Excerpt {
  quote: string;
}

export interface EvidenceBlock {
  label: string;
  documentId: string;
  documentName: string;
  quotes: EvidenceQuote[];
}

export const getFindingDetail = async (owner: string, findingId: string) => {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.findings)
    .where(and(eq(schema.findings.ownerEmail, owner), eq(schema.findings.id, findingId)));
  if (!row) return null;

  const refs = row.refs;
  const ruleIds = [...new Set([...refs.ruleIds, ...(row.explainedByRuleIds ?? [])])];
  const none = ["__none__"];
  const [vendor, invoices, lines, terms, usage, rules] = await Promise.all([
    requireVendor(owner, row.vendorId),
    db.select().from(schema.invoices).where(and(eq(schema.invoices.ownerEmail, owner), inArray(schema.invoices.id, refs.invoiceIds.length ? refs.invoiceIds : none))),
    db.select().from(schema.invoiceLines).where(and(eq(schema.invoiceLines.ownerEmail, owner), inArray(schema.invoiceLines.id, refs.lineIds.length ? refs.lineIds : none))),
    db.select().from(schema.terms).where(and(eq(schema.terms.ownerEmail, owner), inArray(schema.terms.id, refs.termIds.length ? refs.termIds : none))),
    db.select().from(schema.usageTotals).where(and(eq(schema.usageTotals.ownerEmail, owner), inArray(schema.usageTotals.id, refs.usageTotalIds.length ? refs.usageTotalIds : none))),
    db.select().from(schema.vendorRules).where(and(eq(schema.vendorRules.ownerEmail, owner), inArray(schema.vendorRules.id, ruleIds.length ? ruleIds : none))),
  ]);

  const evidences = [
    ...invoices.map((i) => i.evidence),
    ...lines.map((l) => l.evidence),
    ...terms.map((t) => t.evidence),
    ...rules.map((r) => r.proof),
  ];
  const documentIds = [
    ...new Set([...evidences.flatMap((e) => (e ? [e.documentId] : [])), ...usage.map((u) => u.documentId)]),
  ];
  const documents = await db
    .select({ id: schema.documents.id, name: schema.documents.name, text: schema.documents.text })
    .from(schema.documents)
    .where(and(eq(schema.documents.ownerEmail, owner), inArray(schema.documents.id, documentIds.length ? documentIds : none)));
  const docs = new Map(documents.map((doc) => [doc.id, doc]));

  const block = (label: string, evidence: EvidenceJson | null): EvidenceBlock | null => {
    const doc = evidence && docs.get(evidence.documentId);
    if (!evidence || !doc) return null;
    return {
      label,
      documentId: doc.id,
      documentName: doc.name,
      quotes: evidence.fragments.map((f) => ({ quote: f.quote, ...excerpt(doc.text, f.start, f.end) })),
    };
  };
  const present = <T>(items: Array<T | null>): T[] => items.filter((item): item is T => item !== null);

  const invoiceNumber = new Map(invoices.map((invoice) => [invoice.id, invoice.invoiceNumber]));
  // A line-level finding is proven by its lines; a duplicate is proven by the two invoices.
  const bill =
    lines.length > 0
      ? present(lines.map((line) => block(`${invoiceNumber.get(line.invoiceId) ?? "Invoice"} · ${line.description}`, line.evidence)))
      : present(invoices.map((invoice) => block(`${invoice.invoiceNumber} · ${periodLabel(invoice.periodStart, invoice.periodEnd)}`, invoice.evidence)));

  return {
    vendor: { id: vendor.id, name: vendor.name, isSample: vendor.isSample },
    finding: findingSummary(row),
    math: row.math,
    bill,
    agreed: {
      terms: present(
        terms.map((term) => {
          const evidence = block(`${TERM_LABELS[term.key]}: ${formatTermValue(term)}`, term.evidence);
          return term.source === "rule" ? null : evidence;
        }),
      ),
      usage: usage.map((total) => ({
        id: total.id,
        label: `${total.meter} · ${periodLabel(total.periodStart, total.periodEnd)}`,
        quantity: total.quantity,
        quantityLabel: `${formatCount(total.quantity)} tokens logged`,
        documentId: total.documentId,
        documentName: docs.get(total.documentId)?.name ?? "",
      })),
      rules: rules.map((rule) => ({
        id: rule.id,
        description: describeRule(rule),
        reason: rule.reason,
        createdBy: rule.createdBy,
        active: rule.active,
        explainsThis: (row.explainedByRuleIds ?? []).includes(rule.id),
        proof: block("Approval", rule.proof),
      })),
    },
  };
};

export type FindingDetail = NonNullable<Awaited<ReturnType<typeof getFindingDetail>>>;
export type VendorDetail = Awaited<ReturnType<typeof getVendorDetail>>;
export type Overview = Awaited<ReturnType<typeof getOverview>>;

// ---------------------------------------------------------------------------
// Document view
// ---------------------------------------------------------------------------

export interface DocumentMark {
  start: number;
  end: number;
  label: string;
  tone: "bill" | "agreed";
}

/** A document's full text and every quote any record took from it. */
export const getDocumentView = async (owner: string, documentId: string) => {
  const db = getDb();
  const document = await requireDocument(owner, documentId);
  const vendor = await requireVendor(owner, document.vendorId);
  const [terms, invoices, rules] = await Promise.all([
    db.select().from(schema.terms).where(ofVendor(schema.terms, owner, vendor.id)),
    db.select().from(schema.invoices).where(ofVendor(schema.invoices, owner, vendor.id)),
    db.select().from(schema.vendorRules).where(ofVendor(schema.vendorRules, owner, vendor.id)),
  ]);
  const lines = await linesFor(
    owner,
    invoices.filter((invoice) => invoice.documentId === documentId).map((invoice) => invoice.id),
  );

  const marks: DocumentMark[] = [];
  const add = (evidence: EvidenceJson | null, label: string, tone: DocumentMark["tone"]) => {
    if (evidence?.documentId !== documentId) return;
    for (const fragment of evidence.fragments) marks.push({ start: fragment.start, end: fragment.end, label, tone });
  };
  for (const term of terms) add(term.evidence, `${TERM_LABELS[term.key]}: ${formatTermValue(term)}`, "agreed");
  for (const rule of rules) if (rule.active) add(rule.proof, `Proof: ${describeRule(rule)}`, "agreed");
  for (const invoice of invoices) add(invoice.evidence, `${invoice.invoiceNumber} · ${formatUsd(invoice.totalCents)}`, "bill");
  for (const line of lines) add(line.evidence, `${line.description} · ${formatUsd(line.amountCents)}`, "bill");

  return {
    document: {
      id: document.id,
      name: document.name,
      kind: document.kind,
      status: document.status,
      isSample: document.isSample,
      text: document.text,
    },
    vendor: { id: vendor.id, name: vendor.name, isSample: vendor.isSample },
    marks: marks.sort((a, b) => a.start - b.start || b.end - a.end),
  };
};

export type DocumentView = Awaited<ReturnType<typeof getDocumentView>>;
