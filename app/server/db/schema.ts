/**
 * Tallyfoil data model. Every table is private to one user (`owner_email`)
 * and every query filters by it. Money is integer cents, unit prices are
 * integer micro-dollars, quantities are integers (seats or tokens).
 */

import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, bigint } from "drizzle-orm/pg-core";

import type { CheckCode, LineKind, RuleInput, Severity, TermKey, TermSource, VendorKind } from "../audit/types.js";

/** Where an extracted value came from: a document and 1–3 exact quotes in it. */
export interface EvidenceJson {
  documentId: string;
  fragments: Array<{ quote: string; start: number; end: number }>;
}

export type DocumentKind = "contract" | "amendment" | "invoice" | "usage_export" | "note";
export type DocumentStatus = "new" | "read" | "recorded";
export type FindingStatus = "open" | "accepted" | "rejected" | "explained" | "cleared";
export type DisputeStatus = "draft" | "approved" | "credited" | "partially_credited" | "refused";

/** The vendor's answer: the reply document and the exact line(s) that state it. */
export interface DisputeReplyJson extends EvidenceJson {
  outcome: "credited" | "refused";
}

const id = () => text("id").primaryKey();
const owner = () => text("owner_email").notNull();
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const count = (name: string) => bigint(name, { mode: "number" });

export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    ownerEmail: owner(),
    name: text("name").notNull(),
    kind: text("kind").$type<VendorKind>().notNull(),
    isSample: boolean("is_sample").notNull().default(false),
    currency: text("currency").notNull().default("USD"),
    createdAt: createdAt(),
  },
  (t) => [index("vendors_owner_idx").on(t.ownerEmail)],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    ownerEmail: owner(),
    vendorId: text("vendor_id").notNull(),
    kind: text("kind").$type<DocumentKind>().notNull(),
    name: text("name").notNull(),
    text: text("text").notNull(),
    sha256: text("sha256").notNull(),
    isSample: boolean("is_sample").notNull().default(false),
    status: text("status").$type<DocumentStatus>().notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_vendor_idx").on(t.ownerEmail, t.vendorId),
    uniqueIndex("documents_sha_uq").on(t.ownerEmail, t.vendorId, t.sha256),
  ],
);

export const terms = pgTable(
  "terms",
  {
    id: id(),
    ownerEmail: owner(),
    vendorId: text("vendor_id").notNull(),
    key: text("key").$type<TermKey>().notNull(),
    meter: text("meter"),
    valueNum: count("value_num"),
    valueText: text("value_text"),
    valueDate: text("value_date"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    evidence: jsonb("evidence_json").$type<EvidenceJson | null>(),
    source: text("source").$type<TermSource>().notNull().default("agent"),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("terms_vendor_idx").on(t.ownerEmail, t.vendorId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    ownerEmail: owner(),
    vendorId: text("vendor_id").notNull(),
    documentId: text("document_id").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: text("invoice_date").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    totalCents: count("total_cents").notNull(),
    evidence: jsonb("evidence_json").$type<EvidenceJson | null>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_vendor_idx").on(t.ownerEmail, t.vendorId),
    uniqueIndex("invoices_number_uq").on(t.ownerEmail, t.vendorId, t.invoiceNumber),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    ownerEmail: owner(),
    invoiceId: text("invoice_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").$type<LineKind>().notNull(),
    description: text("description").notNull(),
    meter: text("meter"),
    quantity: count("quantity").notNull(),
    unitPriceMicros: count("unit_price_micros").notNull(),
    amountCents: count("amount_cents").notNull(),
    evidence: jsonb("evidence_json").$type<EvidenceJson | null>(),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.ownerEmail, t.invoiceId)],
);

export const usageTotals = pgTable(
  "usage_totals",
  {
    id: id(),
    ownerEmail: owner(),
    vendorId: text("vendor_id").notNull(),
    documentId: text("document_id").notNull(),
    meter: text("meter").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    quantity: count("quantity").notNull(),
  },
  (t) => [index("usage_totals_vendor_idx").on(t.ownerEmail, t.vendorId)],
);

export const vendorRules = pgTable(
  "vendor_rules",
  {
    id: id(),
    ownerEmail: owner(),
    vendorId: text("vendor_id").notNull(),
    type: text("type").$type<RuleInput["type"]>().notNull(),
    payload: jsonb("payload_json").$type<RuleInput["payload"]>().notNull(),
    reason: text("reason").notNull(),
    /** The approval line from an email or note, when the user backed the rule with proof. */
    proof: jsonb("proof_json").$type<EvidenceJson | null>(),
    createdBy: text("created_by").$type<"user" | "agent">().notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("vendor_rules_vendor_idx").on(t.ownerEmail, t.vendorId)],
);

export const auditRuns = pgTable(
  "audit_runs",
  {
    id: id(),
    ownerEmail: owner(),
    scope: text("scope").notNull(),
    engineVersion: text("engine_version").notNull(),
    asOf: text("as_of").notNull(),
    recoverableCents: count("recoverable_cents").notNull(),
    atRiskCents: count("at_risk_cents").notNull(),
    findingCount: integer("finding_count").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_runs_owner_idx").on(t.ownerEmail, t.createdAt)],
);

/** One row per finding fingerprint per vendor; re-runs update it in place. */
export const findings = pgTable(
  "findings",
  {
    id: id(),
    ownerEmail: owner(),
    runId: text("run_id").notNull(),
    vendorId: text("vendor_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    check: text("check").$type<CheckCode>().notNull(),
    severity: text("severity").$type<Severity>().notNull(),
    status: text("status").$type<FindingStatus>().notNull().default("open"),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    amountCents: count("amount_cents").notNull(),
    atRiskCents: count("at_risk_cents").notNull().default(0),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    periodLabel: text("period_label").notNull(),
    invoiceNumber: text("invoice_number"),
    meter: text("meter"),
    deadline: text("deadline"),
    math: jsonb("math_json").$type<Record<string, string | number>>().notNull(),
    refs: jsonb("refs_json").$type<{
      invoiceIds: string[];
      lineIds: string[];
      termIds: string[];
      usageTotalIds: string[];
      ruleIds: string[];
    }>().notNull(),
    explainedByRuleIds: jsonb("explained_by_rule_ids").$type<string[]>(),
    rejectReason: text("reject_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("findings_vendor_idx").on(t.ownerEmail, t.vendorId),
    uniqueIndex("findings_fingerprint_uq").on(t.ownerEmail, t.vendorId, t.fingerprint),
  ],
);

export const disputes = pgTable(
  "disputes",
  {
    id: id(),
    ownerEmail: owner(),
    vendorId: text("vendor_id").notNull(),
    findingIds: jsonb("finding_ids_json").$type<string[]>().notNull(),
    subject: text("subject").notNull(),
    intro: text("intro").notNull(),
    closing: text("closing").notNull(),
    evidenceTableMd: text("evidence_table_md").notNull(),
    amountCents: count("amount_cents").notNull(),
    status: text("status").$type<DisputeStatus>().notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    /** Read by code from the vendor's quoted reply; null until they answer. */
    recoveredCents: count("recovered_cents"),
    reply: jsonb("reply_json").$type<DisputeReplyJson | null>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("disputes_vendor_idx").on(t.ownerEmail, t.vendorId)],
);
