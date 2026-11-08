import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { periodLabel } from "../server/audit/dates.js";
import { formatCount } from "../server/audit/money.js";
import { parseUsageExport } from "../server/audit/usage.js";
import { markDocument, requireDocument, saveUsageTotals } from "../server/tally/records.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Parse a usage-export CSV in code (no reading needed) into monthly token totals per meter. Call it for every usage_export document.",
  schema: z.object({
    documentId: z.string().describe("The usage_export document to parse"),
  }),
  run: async ({ documentId }, ctx) => {
    const owner = ownerOf(ctx);
    const document = await requireDocument(owner, documentId);
    if (document.kind !== "usage_export") {
      fail(`"${document.name}" is a ${document.kind}, not a usage export.`, { errorCode: "wrong_document_kind", statusCode: 400 });
    }

    const parsed = parseUsageExport(document.text);
    if (!parsed.ok) fail(parsed.message, { errorCode: parsed.errorCode, statusCode: 422, details: parsed.details });

    await saveUsageTotals(owner, document.vendorId, document.id, parsed.totals);
    await markDocument(owner, document.id, "recorded");
    return {
      id: document.id,
      totals: parsed.totals.map((total) => ({
        meter: total.meter,
        period: periodLabel(total.periodStart, total.periodEnd),
        tokens: formatCount(total.quantity),
      })),
      message: `Parsed ${parsed.totals.length} monthly meter totals from "${document.name}".`,
      nextRequiredAction: "run-audit",
    };
  },
});
