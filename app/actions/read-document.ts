import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { markDocument, numberedLines, requireDocument } from "../server/tally/records.js";
import { ownerOf } from "../server/tally/session.js";

const PAGE_LINES = 200;

export default defineAction({
  description:
    'Read up to 6 documents as numbered lines ("12 | text"), a page at a time. Quote from this text when recording terms or invoices.',
  schema: z.object({
    documentIds: z.array(z.string()).min(1).max(6).describe("Documents to read (e.g. a batch of invoices)"),
    fromLine: z.coerce.number().int().min(1).default(1).describe("First line to return (1-based), applied to each document"),
    toLine: z.coerce.number().int().min(1).optional().describe(`Last line to return; defaults to fromLine + ${PAGE_LINES - 1}`),
  }),
  http: { method: "GET" },
  deferLoading: false,
  run: async ({ documentIds, fromLine, toLine }, ctx) => {
    const owner = ownerOf(ctx);
    const documents = [];
    for (const documentId of documentIds) {
      const document = await requireDocument(owner, documentId);
      if (document.status === "new") await markDocument(owner, document.id, "read");
      const page = numberedLines(document.text, fromLine, toLine ?? fromLine + PAGE_LINES - 1);
      documents.push({
        id: document.id,
        name: document.name,
        kind: document.kind,
        vendorId: document.vendorId,
        isSample: document.isSample,
        ...page,
        hasMore: page.toLine < page.totalLines,
      });
    }
    return { documents };
  },
});
