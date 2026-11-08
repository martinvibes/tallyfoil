import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { markDocument, numberedLines, requireDocument } from "../server/tally/records.js";
import { ownerOf } from "../server/tally/session.js";

const PAGE_LINES = 200;

export default defineAction({
  description:
    'Read a document\'s text as numbered lines ("12 | text"), a page at a time. Quote from this text when recording terms or invoices.',
  schema: z.object({
    documentId: z.string().describe("Document to read"),
    fromLine: z.coerce.number().int().min(1).default(1).describe("First line to return (1-based)"),
    toLine: z.coerce.number().int().min(1).optional().describe(`Last line to return; defaults to fromLine + ${PAGE_LINES - 1}`),
  }),
  http: { method: "GET" },
  deferLoading: false,
  run: async ({ documentId, fromLine, toLine }, ctx) => {
    const owner = ownerOf(ctx);
    const document = await requireDocument(owner, documentId);
    if (document.status === "new") await markDocument(owner, document.id, "read");

    const page = numberedLines(document.text, fromLine, toLine ?? fromLine + PAGE_LINES - 1);
    return {
      id: document.id,
      name: document.name,
      kind: document.kind,
      vendorId: document.vendorId,
      isSample: document.isSample,
      ...page,
      hasMore: page.toLine < page.totalLines,
    };
  },
});
