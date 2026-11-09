import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { describeRun } from "../server/tally/audit-runner.js";
import { ownerOf } from "../server/tally/session.js";
import { removeVendorRule } from "../server/tally/steering.js";

export default defineAction({
  description: "Switch off a vendor rule and re-run the audit; findings it explained come back.",
  schema: z.object({
    ruleId: z.string().describe("Rule to remove"),
  }),
  run: async ({ ruleId }, ctx) => {
    const { run } = await removeVendorRule(ownerOf(ctx), ruleId);
    return { id: ruleId, message: `Removed the rule. ${describeRun(run)}` };
  },
});
