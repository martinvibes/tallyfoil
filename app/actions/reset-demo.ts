import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { resetAllData } from "../server/tally/samples.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description: "Delete all of the current user's Tallyfoil data (vendors, documents, findings, disputes).",
  schema: z.object({}),
  agentTool: false,
  run: async (_args, ctx) => {
    await resetAllData(ownerOf(ctx));
    return { message: "All Tallyfoil data deleted." };
  },
});
