import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { storedLedger } from "../server/tally/audit-runner.js";
import { ownerOf } from "../server/tally/session.js";
import { reviewFindings } from "../server/tally/steering.js";
import { formatUsd } from "../server/audit/money.js";

export default defineAction({
  description:
    "Accept or reject findings (one row or a whole group). Rejecting needs the user's reason; if the reason generalizes, follow with add-vendor-rule.",
  schema: z.object({
    findingIds: z.array(z.string()).min(1).max(50).describe("Findings to review"),
    decision: z.enum(["accept", "reject"]).describe("accept = the user agrees it's an overcharge; reject = it's legitimate"),
    reason: z.string().max(1000).optional().describe("Required for reject: the user's words, verbatim"),
  }),
  deferLoading: false,
  run: async ({ findingIds, decision, reason }, ctx) => {
    const owner = ownerOf(ctx);
    const result = await reviewFindings(owner, findingIds, decision, reason);
    const ledger = await storedLedger(owner);
    return {
      id: findingIds[0] ?? "",
      ...result,
      recoverable: formatUsd(ledger.recoverableCents),
      message: `${decision === "accept" ? "Accepted" : "Rejected"} ${result.updated} finding${result.updated === 1 ? "" : "s"}. Recoverable is now ${formatUsd(ledger.recoverableCents)}.`,
      nextRequiredAction:
        decision === "reject"
          ? "If the reason applies beyond this finding (an approval, an agreed price), ask the user to paste the email that proves it, add it with add-document (kind note), then add-vendor-rule with proof."
          : "draft-dispute when the user is ready",
    };
  },
});
