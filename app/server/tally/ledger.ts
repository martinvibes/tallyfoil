/**
 * The money the user can act on, after their review. The engine's totals
 * count every finding; the ledger counts only findings still standing
 * (open or accepted). Deadlines are exposure, not overcharges, so they
 * feed "at risk" and never "recoverable".
 */

import type { CheckCode } from "../audit/types.js";
import type { FindingStatus } from "../db/schema.js";

export interface LedgerRow {
  check: CheckCode;
  status: FindingStatus;
  amountCents: number;
  atRiskCents: number;
}

export interface LedgerTotals {
  recoverableCents: number;
  atRiskCents: number;
  /** Standing findings that carry money. */
  findingCount: number;
  /** Standing renewal deadlines. */
  deadlineCount: number;
  openCount: number;
  acceptedCount: number;
  rejectedCount: number;
  explainedCount: number;
}

const STANDING: ReadonlySet<FindingStatus> = new Set(["open", "accepted"]);

export const isStanding = (status: FindingStatus): boolean => STANDING.has(status);

export const isDeadline = (check: CheckCode): boolean => check === "RENEWAL_NOTICE_DEADLINE";

export const ledgerTotals = (rows: readonly LedgerRow[]): LedgerTotals => {
  const totals: LedgerTotals = {
    recoverableCents: 0,
    atRiskCents: 0,
    findingCount: 0,
    deadlineCount: 0,
    openCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    explainedCount: 0,
  };
  for (const row of rows) {
    if (row.status === "open") totals.openCount++;
    if (row.status === "accepted") totals.acceptedCount++;
    if (row.status === "rejected") totals.rejectedCount++;
    if (row.status === "explained") totals.explainedCount++;
    if (!isStanding(row.status)) continue;

    if (isDeadline(row.check)) {
      totals.atRiskCents += row.atRiskCents;
      totals.deadlineCount++;
    } else {
      totals.recoverableCents += row.amountCents;
      totals.findingCount++;
    }
  }
  return totals;
};
