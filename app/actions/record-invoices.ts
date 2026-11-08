import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { formatUsd } from "../server/audit/money.js";
import { groundInvoices } from "../server/tally/grounding.js";
import { failWithProblems } from "../server/tally/problems.js";
import { markDocument, requireDocument, saveInvoices } from "../server/tally/records.js";
import { invoiceItemSchema } from "../server/tally/schemas.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Record the invoice(s) in one document with every line. Values must appear in the quotes, qty × unit price must equal each amount, and lines must sum to the total.",
  schema: z.object({
    documentId: z.string().describe("The invoice document the quotes come from"),
    invoices: z.array(invoiceItemSchema).min(1).max(5).describe("Invoices in this document (usually one)"),
  }),
  deferLoading: false,
  run: async ({ documentId, invoices }, ctx) => {
    const owner = ownerOf(ctx);
    const document = await requireDocument(owner, documentId);
    const { grounded, problems } = groundInvoices(document, invoices);

    const recorded = grounded.map((item) => item.value);
    const ids = await saveInvoices(owner, document.vendorId, document.id, recorded);
    if (recorded.length > 0) await markDocument(owner, document.id, "recorded");
    if (problems.length > 0) failWithProblems("invoices", recorded.length, problems);

    const summary = recorded.map((invoice) => `${invoice.invoiceNumber} (${formatUsd(invoice.totalCents)}, ${invoice.lines.length} lines)`);
    return {
      id: ids[0] ?? document.id,
      invoiceIds: ids,
      message: `Recorded ${summary.join(", ")} from "${document.name}".`,
      nextRequiredAction: "record the vendor's remaining documents, then run-audit",
    };
  },
});
