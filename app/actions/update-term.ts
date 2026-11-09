import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { describeRun } from "../server/tally/audit-runner.js";
import { ownerOf } from "../server/tally/session.js";
import { updateTerm } from "../server/tally/steering.js";

export default defineAction({
  description: "Correct a recorded term by hand (marked as the user's edit; re-reads won't overwrite it), then re-run the audit.",
  schema: z.object({
    termId: z.string().describe("Term to correct"),
    value: z.union([z.string(), z.number()]).describe('New value as written, e.g. "24.00", "48", "5%", "2026-01-31", "yes"'),
    expectedRevision: z.coerce.number().int().min(1).describe("The term's revision when the user started editing"),
  }),
  run: async ({ termId, value, expectedRevision }, ctx) => {
    const { term, run } = await updateTerm(ownerOf(ctx), termId, value, expectedRevision);
    return { id: term.id, message: `Updated the term. ${describeRun(run)}` };
  },
});
