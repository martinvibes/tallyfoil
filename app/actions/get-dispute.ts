import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { disputeView } from "../server/tally/disputes.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description: "A dispute draft: its prose, the code-built evidence table and total, status, and the full email text.",
  schema: z.object({
    disputeId: z.string().describe("Dispute id"),
  }),
  http: { method: "GET" },
  run: async ({ disputeId }, ctx) => disputeView(ownerOf(ctx), disputeId),
});
