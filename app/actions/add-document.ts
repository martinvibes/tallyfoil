import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { addDocument, requireVendor } from "../server/tally/records.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Store a document's text for a vendor (contract, amendment, invoice, usage export, or a pasted note/email). Same text twice is stored once.",
  schema: z.object({
    vendorId: z.string().describe("Vendor the document belongs to"),
    kind: z
      .enum(["contract", "amendment", "invoice", "usage_export", "note"])
      .describe("contract/amendment for agreed terms, invoice for bills, usage_export for a usage CSV, note for emails and anything else"),
    name: z.string().min(1).max(200).describe('File name or a short title, e.g. "approval-email-2026-03-28.txt"'),
    text: z.string().min(1).max(500_000).describe("The full extracted text"),
  }),
  run: async ({ vendorId, kind, name, text }, ctx) => {
    const owner = ownerOf(ctx);
    const vendor = await requireVendor(owner, vendorId);
    const { document, duplicate } = await addDocument(owner, { vendorId, kind, name, text });
    const lineCount = document.text.split(/\r?\n/).length;
    return {
      id: document.id,
      document: { id: document.id, name: document.name, kind: document.kind, lineCount },
      duplicate,
      message: duplicate
        ? `${vendor.name} already has this document as "${document.name}".`
        : `Added "${document.name}" (${lineCount} lines) to ${vendor.name}.`,
      nextRequiredAction: kind === "usage_export" ? "ingest-usage-export" : "read-document",
    };
  },
});
