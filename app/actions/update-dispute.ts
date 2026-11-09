import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { updateDispute } from "../server/tally/disputes.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description: "Edit a draft dispute's subject, intro or closing. The number guard runs again on the new text.",
  schema: z.object({
    disputeId: z.string().describe("Dispute to edit"),
    subject: z.string().min(1).max(200).optional().describe("New subject"),
    intro: z.string().min(1).max(4000).optional().describe("New intro"),
    closing: z.string().min(1).max(4000).optional().describe("New closing"),
    expectedRevision: z.coerce.number().int().min(1).describe("The draft's revision when editing started"),
  }),
  run: async ({ disputeId, expectedRevision, ...changes }, ctx) => {
    const result = await updateDispute(ownerOf(ctx), disputeId, changes, expectedRevision);
    return { ...result, message: "Saved the draft." };
  },
});
