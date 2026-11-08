import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { ownerOf } from "../server/tally/session.js";
import { getFindingDetail } from "../server/tally/views.js";

export default defineAction({
  description:
    "One finding with its proof: the bill quotes, the contract/usage quotes, the rules involved, and the arithmetic behind the amount.",
  schema: z.object({
    findingId: z.string().describe("Finding id"),
  }),
  http: { method: "GET" },
  run: async ({ findingId }, ctx) => {
    const detail = await getFindingDetail(ownerOf(ctx), findingId);
    if (!detail) fail(`No finding with id "${findingId}". Call get-vendor to list findings.`, { errorCode: "finding_not_found", statusCode: 404 });
    return detail;
  },
});
