import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ownerOf } from "../server/tally/session.js";
import { getDocumentView } from "../server/tally/views.js";

export default defineAction({
  description: "A document's full text with every recorded quote marked, for the document screen.",
  schema: z.object({
    documentId: z.string().describe("Document id"),
  }),
  http: { method: "GET" },
  agentTool: false,
  readOnly: true,
  run: async ({ documentId }, ctx) => getDocumentView(ownerOf(ctx), documentId),
});
