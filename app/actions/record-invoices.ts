import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { formatUsd } from "../server/audit/money.js";
import { type GroundedInvoice, type ItemProblem, groundInvoices } from "../server/tally/grounding.js";
import { failWithProblems } from "../server/tally/problems.js";
import { type DocumentRow, markDocument, requireDocument, saveInvoices } from "../server/tally/records.js";
import { invoiceItemSchema } from "../server/tally/schemas.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Record up to 6 invoices (from one or more invoice documents) with every line. Values must appear in the quotes, qty × unit price must equal each amount, and lines must sum to the total.",
  schema: z.object({
    invoices: z
      .array(invoiceItemSchema.extend({ documentId: z.string().describe("The invoice document this invoice's quotes come from") }))
      .min(1)
      .max(6)
      .describe("Invoices to record"),
  }),
  deferLoading: false,
  run: async ({ invoices }, ctx) => {
    const owner = ownerOf(ctx);
    const documents = new Map<string, DocumentRow>();
    for (const { documentId } of invoices) {
      if (!documents.has(documentId)) documents.set(documentId, await requireDocument(owner, documentId));
    }

    const recorded: Array<GroundedInvoice & { documentId: string }> = [];
    const problems: ItemProblem[] = [];
    invoices.forEach((item, index) => {
      const document = documents.get(item.documentId);
      if (!document) return;
      const result = groundInvoices(document, [item]);
      for (const { value } of result.grounded) recorded.push({ ...value, documentId: document.id });
      for (const problem of result.problems) problems.push({ ...problem, index });
    });

    const ids: string[] = [];
    for (const invoice of recorded) {
      const document = documents.get(invoice.documentId);
      if (!document) continue;
      ids.push(...(await saveInvoices(owner, document.vendorId, document.id, [invoice])));
      await markDocument(owner, document.id, "recorded");
    }
    if (problems.length > 0) failWithProblems("invoices", recorded.length, problems);

    const summary = recorded.map((invoice) => `${invoice.invoiceNumber} (${formatUsd(invoice.totalCents)}, ${invoice.lines.length} line${invoice.lines.length === 1 ? "" : "s"})`);
    return {
      id: ids[0] ?? "",
      invoiceIds: ids,
      message: `Recorded ${summary.join(", ")}.`,
      nextRequiredAction: "record the vendor's remaining invoices, then run-audit",
    };
  },
});
