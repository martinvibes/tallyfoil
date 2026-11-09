/**
 * Dispute drafts. The agent or user writes the prose; code picks the
 * findings, builds the table, totals it and guards the prose's numbers.
 */

import { fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";

import { formatUsd } from "../audit/money.js";
import { getDb, schema } from "../db/index.js";
import { type DisputeLine, type Prose, composeDispute, guardProse, sortedLines } from "./dispute-compose.js";
import { CHECK_LABELS } from "./format.js";
import { isDeadline, isStanding } from "./ledger.js";
import { requireVendor } from "./records.js";
import { newId, nowTimestamp } from "./session.js";

type FindingRow = typeof schema.findings.$inferSelect;
type DisputeRow = typeof schema.disputes.$inferSelect;

/** Default selection: everything the user accepted, plus open clear breaches. */
const disputable = (row: FindingRow) =>
  !isDeadline(row.check) && (row.status === "accepted" || (row.status === "open" && row.severity === "breach"));

const lineOf = (row: FindingRow): DisputeLine => ({
  periodStart: row.periodStart,
  periodLabel: row.periodLabel,
  invoiceNumber: row.invoiceNumber,
  issue: CHECK_LABELS[row.check],
  explanation: row.explanation,
  amountCents: row.amountCents,
});

const selectFindings = async (owner: string, vendorId: string, findingIds?: readonly string[]) => {
  const rows = await getDb()
    .select()
    .from(schema.findings)
    .where(and(eq(schema.findings.ownerEmail, owner), eq(schema.findings.vendorId, vendorId)));
  if (!findingIds || findingIds.length === 0) return rows.filter(disputable);

  const chosen = rows.filter((row) => findingIds.includes(row.id));
  const unusable = findingIds.filter((id) => {
    const row = chosen.find((r) => r.id === id);
    return !row || !isStanding(row.status) || isDeadline(row.check);
  });
  if (unusable.length > 0) {
    fail("Some findings can't go in a dispute (unknown, rejected, explained, or a deadline).", {
      errorCode: "finding_not_disputable",
      statusCode: 400,
      details: { findingIds: unusable },
    });
  }
  return chosen;
};

const requireGuarded = (prose: Prose, lines: readonly DisputeLine[]) => {
  const guard = guardProse(prose, lines);
  if (!guard.ok) {
    const list = guard.offending.map((o) => `"${o.text}" in the ${o.field}`).join(", ");
    fail(
      `The number guard blocked ${list}: that amount was not computed from your documents. ` +
        "Remove it — the itemized table and total are added by code.",
      { errorCode: "unverified_amount", statusCode: 422, details: { offending: guard.offending } },
    );
  }
};

const linesFor = async (owner: string, dispute: Pick<DisputeRow, "findingIds">) => {
  const rows = await getDb()
    .select()
    .from(schema.findings)
    .where(and(eq(schema.findings.ownerEmail, owner), inArray(schema.findings.id, dispute.findingIds.length ? dispute.findingIds : ["__none__"])));
  return rows.map(lineOf);
};

export const draftDispute = async (owner: string, input: Prose & { vendorId: string; findingIds?: string[] | undefined }) => {
  const vendor = await requireVendor(owner, input.vendorId);
  const findings = await selectFindings(owner, vendor.id, input.findingIds);
  if (findings.length === 0) {
    fail("Nothing to dispute yet: accept findings or wait for clear breaches.", { errorCode: "nothing_to_dispute", statusCode: 400 });
  }
  const lines = findings.map(lineOf);
  const prose = { subject: input.subject, intro: input.intro, closing: input.closing };
  requireGuarded(prose, lines);
  const composed = composeDispute(lines, prose);

  const id = newId("dsp");
  await getDb().insert(schema.disputes).values({
    id,
    ownerEmail: owner,
    vendorId: vendor.id,
    findingIds: findings.map((f) => f.id),
    ...prose,
    evidenceTableMd: composed.tableMd,
    amountCents: composed.totalCents,
  });
  return { id, vendorName: vendor.name, totalCents: composed.totalCents, findingCount: findings.length };
};

export const requireDispute = async (owner: string, disputeId: string) => {
  const [dispute] = await getDb()
    .select()
    .from(schema.disputes)
    .where(and(eq(schema.disputes.ownerEmail, owner), eq(schema.disputes.id, disputeId)));
  if (!dispute) fail(`No dispute with id "${disputeId}".`, { errorCode: "dispute_not_found", statusCode: 404 });
  return dispute;
};

export const updateDispute = async (owner: string, disputeId: string, changes: { [K in keyof Prose]?: Prose[K] | undefined }, expectedRevision: number) => {
  const dispute = await requireDispute(owner, disputeId);
  if (dispute.revision !== expectedRevision) {
    fail("This draft changed since you opened it. Reload and try again.", { errorCode: "save_conflict", statusCode: 409, details: { currentRevision: dispute.revision } });
  }
  if (dispute.status === "approved") fail("This dispute is already approved.", { errorCode: "already_approved", statusCode: 409 });

  const prose: Prose = {
    subject: changes.subject ?? dispute.subject,
    intro: changes.intro ?? dispute.intro,
    closing: changes.closing ?? dispute.closing,
  };
  requireGuarded(prose, await linesFor(owner, dispute));
  await getDb()
    .update(schema.disputes)
    .set({ ...prose, revision: dispute.revision + 1, updatedAt: nowTimestamp() })
    .where(and(eq(schema.disputes.ownerEmail, owner), eq(schema.disputes.id, disputeId)));
  return { id: disputeId, revision: dispute.revision + 1 };
};

export const disputeView = async (owner: string, disputeId: string) => {
  const dispute = await requireDispute(owner, disputeId);
  const vendor = await requireVendor(owner, dispute.vendorId);
  const lines = await linesFor(owner, dispute);
  const composed = composeDispute(lines, dispute);
  return {
    id: dispute.id,
    vendor: { id: vendor.id, name: vendor.name, isSample: vendor.isSample },
    status: dispute.status,
    revision: dispute.revision,
    subject: dispute.subject,
    intro: dispute.intro,
    closing: dispute.closing,
    findingIds: dispute.findingIds,
    lines: sortedLines(lines).map((line) => ({ ...line, amount: formatUsd(line.amountCents) })),
    evidenceTableMd: composed.tableMd,
    totalCents: composed.totalCents,
    total: formatUsd(composed.totalCents),
    body: composed.body,
    mailto: `mailto:?subject=${encodeURIComponent(dispute.subject)}&body=${encodeURIComponent(composed.body)}`,
    updatedAt: dispute.updatedAt,
  };
};

export const approveDispute = async (owner: string, disputeId: string) => {
  const dispute = await requireDispute(owner, disputeId);
  requireGuarded(dispute, await linesFor(owner, dispute));
  await getDb()
    .update(schema.disputes)
    .set({ status: "approved", updatedAt: nowTimestamp() })
    .where(and(eq(schema.disputes.ownerEmail, owner), eq(schema.disputes.id, disputeId)));
  return disputeView(owner, disputeId);
};

export type DisputeView = Awaited<ReturnType<typeof disputeView>>;

export const listDisputes = async (owner: string, vendorId: string) =>
  getDb()
    .select({ id: schema.disputes.id, subject: schema.disputes.subject, status: schema.disputes.status, amountCents: schema.disputes.amountCents, updatedAt: schema.disputes.updatedAt })
    .from(schema.disputes)
    .where(and(eq(schema.disputes.ownerEmail, owner), eq(schema.disputes.vendorId, vendorId)));
