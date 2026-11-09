import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { approveDispute } from "../server/tally/disputes.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Approve a dispute draft. Returns the final email and a mailto link; the user sends it themselves — Tallyfoil never sends email.",
  schema: z.object({
    disputeId: z.string().describe("Dispute to approve"),
  }),
  needsApproval: true,
  run: async ({ disputeId }, ctx) => {
    const dispute = await approveDispute(ownerOf(ctx), disputeId);
    return {
      ...dispute,
      message: `Approved. The email to ${dispute.vendor.name} for ${dispute.total} is ready to copy or open in your mail app.`,
    };
  },
});
