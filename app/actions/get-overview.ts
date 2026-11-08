import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ownerOf } from "../server/tally/session.js";
import { getOverview } from "../server/tally/views.js";

export default defineAction({
  description: "Totals (recoverable, at risk, nearest deadline), every vendor with its counts, and the latest audit run.",
  schema: z.object({}),
  http: { method: "GET" },
  deferLoading: false,
  run: async (_args, ctx) => getOverview(ownerOf(ctx)),
});
