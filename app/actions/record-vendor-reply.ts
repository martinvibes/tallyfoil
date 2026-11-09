import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { recordVendorReply } from "../server/tally/disputes.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Record the vendor's reply to an approved dispute. Quote the line that states what they credited (or refused); code reads the amount from that line and updates the Recovered total.",
  schema: z.object({
    disputeId: z.string().describe("The approved dispute the vendor answered"),
    documentId: z.string().describe("The vendor's reply, added with add-document (kind: note)"),
    outcome: z.enum(["credited", "refused"]).describe("credited if they agreed to credit or refund any amount, refused if they declined"),
    quotes: z
      .array(z.string().min(1))
      .min(1)
      .max(3)
      .describe("1-3 lines copied exactly from the reply; for a credit, the line must state the credited amount"),
  }),
  run: async (args, ctx) => {
    const dispute = await recordVendorReply(ownerOf(ctx), args);
    const message =
      dispute.status === "refused"
        ? `${dispute.vendor.name} refused the dispute. Nothing recovered yet.`
        : `${dispute.vendor.name} credited ${dispute.recovered} of the ${dispute.total} disputed.`;
    return {
      id: dispute.id,
      status: dispute.status,
      recoveredCents: dispute.recoveredCents,
      recovered: dispute.recovered,
      total: dispute.total,
      message,
      nextRequiredAction: "Tell the user the outcome using the amounts above; if partial or refused, offer to draft a follow-up",
    };
  },
});
