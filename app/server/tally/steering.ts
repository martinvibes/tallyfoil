/**
 * How the user steers the audit: review decisions, vendor rules (optionally
 * proven by a quote from an email or note), and hand corrections to terms.
 * Every change that can move money re-runs the engine.
 */

import { fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";

import { type ClaimedValue, matchEvidence } from "../audit/evidence.js";
import type { CheckCode, RuleInput, TermKey } from "../audit/types.js";
import { getDb, schema } from "../db/index.js";
import type { EvidenceJson } from "../db/schema.js";
import { type AuditRunResult, runAudit } from "./audit-runner.js";
import { isStanding } from "./ledger.js";
import { markDocument, requireDocument, requireVendor } from "./records.js";
import { newId, nowTimestamp } from "./session.js";
import { type RawValue, parseTermValue } from "./term-values.js";

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export const reviewFindings = async (owner: string, findingIds: readonly string[], decision: "accept" | "reject", reason?: string) => {
  if (decision === "reject" && !reason?.trim()) {
    fail('Rejecting needs a reason ("Why is this OK?").', { errorCode: "reason_required", statusCode: 400 });
  }
  const db = getDb();
  const rows = await db
    .select({ id: schema.findings.id, status: schema.findings.status, vendorId: schema.findings.vendorId })
    .from(schema.findings)
    .where(and(eq(schema.findings.ownerEmail, owner), inArray(schema.findings.id, [...findingIds])));
  const missing = findingIds.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length > 0) fail(`Unknown finding ids: ${missing.join(", ")}.`, { errorCode: "finding_not_found", statusCode: 404, details: { missing } });

  const reviewable = rows.filter((row) => isStanding(row.status) || row.status === "rejected");
  if (reviewable.length > 0) {
    await db
      .update(schema.findings)
      .set({
        status: decision === "accept" ? "accepted" : "rejected",
        rejectReason: decision === "reject" ? (reason?.trim() ?? null) : null,
        reviewedAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      })
      .where(and(eq(schema.findings.ownerEmail, owner), inArray(schema.findings.id, reviewable.map((row) => row.id))));
  }
  return { updated: reviewable.length, skipped: rows.length - reviewable.length, vendorIds: [...new Set(rows.map((row) => row.vendorId))] };
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type RuleSpec =
  | { type: "override_term"; key: TermKey; value: RawValue; meter?: string | null | undefined; effectiveFrom?: string | null | undefined; effectiveTo?: string | null | undefined }
  | { type: "waive_check"; check: CheckCode; periodFrom?: string | null | undefined; periodTo?: string | null | undefined; meter?: string | null | undefined };

export interface ProofSpec {
  documentId: string;
  quotes: string[];
}

const toPayload = (spec: RuleSpec): { payload: RuleInput["payload"]; claim: ClaimedValue } => {
  if (spec.type === "waive_check") {
    return {
      payload: { check: spec.check, periodFrom: spec.periodFrom ?? null, periodTo: spec.periodTo ?? null, meter: spec.meter ?? null },
      claim: { kind: "presence" },
    };
  }
  const parsed = parseTermValue(spec.key, spec.value);
  if (!parsed.ok) fail(parsed.message, { errorCode: "invalid_value", statusCode: 400 });
  const { valueNum, valueDate, valueText, claim } = parsed.value;
  const value = valueNum ?? valueDate ?? valueText;
  if (value === null) fail(`No value for ${spec.key}.`, { errorCode: "invalid_value", statusCode: 400 });
  return {
    payload: {
      key: spec.key,
      value,
      meter: spec.meter ?? null,
      effectiveFrom: spec.effectiveFrom ?? null,
      effectiveTo: spec.effectiveTo ?? null,
    },
    claim,
  };
};

/** The approval line must exist in the note and state the rule's value. */
const proveRule = async (owner: string, vendorId: string, proof: ProofSpec, claim: ClaimedValue): Promise<EvidenceJson> => {
  const document = await requireDocument(owner, proof.documentId);
  if (document.vendorId !== vendorId) fail("The proof document belongs to another vendor.", { errorCode: "wrong_vendor", statusCode: 400 });
  const result = matchEvidence(document.text, proof.quotes.map((quote) => ({ quote })), claim);
  if (!result.ok) fail(`Proof: ${result.message}`, { errorCode: result.errorCode, statusCode: 422 });
  await markDocument(owner, document.id, "recorded");
  return { documentId: document.id, fragments: result.fragments };
};

export const addVendorRule = async (
  owner: string,
  input: { vendorId: string; rule: RuleSpec; reason: string; proof?: ProofSpec | undefined; createdBy: "user" | "agent" },
): Promise<{ ruleId: string; proven: boolean; run: AuditRunResult }> => {
  await requireVendor(owner, input.vendorId);
  const { payload, claim } = toPayload(input.rule);
  const proof = input.proof ? await proveRule(owner, input.vendorId, input.proof, claim) : null;

  const ruleId = newId("rul");
  await getDb().insert(schema.vendorRules).values({
    id: ruleId,
    ownerEmail: owner,
    vendorId: input.vendorId,
    type: input.rule.type,
    payload,
    reason: input.reason.trim(),
    proof,
    createdBy: input.createdBy,
  });
  return { ruleId, proven: proof !== null, run: await runAudit(owner, input.vendorId) };
};

const requireRule = async (owner: string, ruleId: string) => {
  const [rule] = await getDb()
    .select()
    .from(schema.vendorRules)
    .where(and(eq(schema.vendorRules.ownerEmail, owner), eq(schema.vendorRules.id, ruleId)));
  if (!rule) fail(`No rule with id "${ruleId}".`, { errorCode: "rule_not_found", statusCode: 404 });
  return rule;
};

export const removeVendorRule = async (owner: string, ruleId: string) => {
  const rule = await requireRule(owner, ruleId);
  await getDb()
    .update(schema.vendorRules)
    .set({ active: false })
    .where(and(eq(schema.vendorRules.ownerEmail, owner), eq(schema.vendorRules.id, ruleId)));
  return { rule, run: await runAudit(owner, rule.vendorId) };
};

// ---------------------------------------------------------------------------
// Term corrections
// ---------------------------------------------------------------------------

export const updateTerm = async (owner: string, termId: string, value: RawValue, expectedRevision: number) => {
  const db = getDb();
  const [term] = await db
    .select()
    .from(schema.terms)
    .where(and(eq(schema.terms.ownerEmail, owner), eq(schema.terms.id, termId)));
  if (!term) fail(`No term with id "${termId}".`, { errorCode: "term_not_found", statusCode: 404 });
  if (term.revision !== expectedRevision) {
    fail("This term changed since you read it. Reload and try again.", {
      errorCode: "save_conflict",
      statusCode: 409,
      details: { currentRevision: term.revision },
    });
  }
  const parsed = parseTermValue(term.key, value);
  if (!parsed.ok) fail(parsed.message, { errorCode: "invalid_value", statusCode: 400 });

  await db
    .update(schema.terms)
    .set({
      valueNum: parsed.value.valueNum,
      valueText: parsed.value.valueText,
      valueDate: parsed.value.valueDate,
      source: "user",
      revision: term.revision + 1,
      updatedAt: nowTimestamp(),
    })
    .where(and(eq(schema.terms.ownerEmail, owner), eq(schema.terms.id, termId)));
  return { term, run: await runAudit(owner, term.vendorId) };
};
