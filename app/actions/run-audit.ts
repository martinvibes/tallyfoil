import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { formatUsd } from "../server/audit/money.js";
import { describeRun, runAudit } from "../server/tally/audit-runner.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Run the deterministic audit (code, not AI) for one vendor or all vendors. Computes every finding and dollar amount, keeps review decisions, and reports what changed.",
  schema: z.object({
    vendorId: z.string().optional().describe("Vendor to audit; omit to audit every vendor"),
  }),
  deferLoading: false,
  run: async ({ vendorId }, ctx) => {
    const run = await runAudit(ownerOf(ctx), vendorId);
    return {
      id: run.runId,
      asOf: run.asOf,
      engineVersion: run.engineVersion,
      recoverable: formatUsd(run.after.recoverableCents),
      atRisk: formatUsd(run.after.atRiskCents),
      findingCount: run.after.findingCount,
      change: {
        recoverableBefore: formatUsd(run.before.recoverableCents),
        recoverableAfter: formatUsd(run.after.recoverableCents),
        atRiskBefore: formatUsd(run.before.atRiskCents),
        atRiskAfter: formatUsd(run.after.atRiskCents),
      },
      vendors: run.vendors.map((vendor) => ({
        vendorId: vendor.vendorId,
        name: vendor.vendorName,
        findingCount: vendor.findingCount,
        recoverable: formatUsd(vendor.recoverableCents),
        atRisk: formatUsd(vendor.atRiskCents),
        newOrReopened: vendor.opened,
        resolved: vendor.resolved,
        explainedByRules: vendor.explainedCount,
        noBillsYet: vendor.empty,
      })),
      message: describeRun(run),
      nextRequiredAction: "get-vendor to walk the user through the findings, quoting amounts exactly as given",
    };
  },
});
