/**
 * Plans how a fresh audit lands on stored findings. Findings are matched by
 * fingerprint, so a re-run keeps the user's accept/reject decisions, brings
 * back findings that reappear, and retires findings that vanished — as
 * "explained" when a vendor rule removed them, "cleared" otherwise.
 */

import type { AuditOutput, Finding } from "../audit/types.js";
import type { FindingStatus } from "../db/schema.js";

export interface StoredFinding {
  id: string;
  fingerprint: string;
  status: FindingStatus;
}

export interface ReconcilePlan {
  insert: Finding[];
  update: Array<{ id: string; finding: Finding; status: FindingStatus }>;
  retire: Array<{ id: string; status: "explained" | "cleared"; ruleIds: string[] | null }>;
  /** Findings that are new, or open again after they had gone. */
  opened: number;
  /** Findings that just left the list (explained by a rule or cleared). */
  resolved: number;
}

const isRetired = (status: FindingStatus) => status === "explained" || status === "cleared";

/** A decision the user made survives re-runs; anything else that reappears is open again. */
const statusOnReturn = (previous: FindingStatus): FindingStatus =>
  previous === "accepted" || previous === "rejected" ? previous : "open";

export const reconcileFindings = (
  stored: readonly StoredFinding[],
  output: Pick<AuditOutput, "findings" | "explained">,
): ReconcilePlan => {
  const byFingerprint = new Map(stored.map((row) => [row.fingerprint, row]));
  const current = new Set(output.findings.map((f) => f.fingerprint));
  const explainedBy = new Map(output.explained.map((e) => [e.fingerprint, e.ruleIds]));
  const plan: ReconcilePlan = { insert: [], update: [], retire: [], opened: 0, resolved: 0 };

  for (const finding of output.findings) {
    const previous = byFingerprint.get(finding.fingerprint);
    if (!previous) {
      plan.insert.push(finding);
      plan.opened++;
      continue;
    }
    const status = statusOnReturn(previous.status);
    if (isRetired(previous.status)) plan.opened++;
    plan.update.push({ id: previous.id, finding, status });
  }

  for (const row of stored) {
    if (current.has(row.fingerprint)) continue;
    const ruleIds = explainedBy.get(row.fingerprint) ?? null;
    if (!isRetired(row.status)) plan.resolved++;
    plan.retire.push({ id: row.id, status: ruleIds ? "explained" : "cleared", ruleIds });
  }
  return plan;
};
