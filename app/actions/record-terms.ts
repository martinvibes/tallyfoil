import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { groundTerms } from "../server/tally/grounding.js";
import { failWithProblems } from "../server/tally/problems.js";
import { markDocument, requireDocument, saveTerms } from "../server/tally/records.js";
import { termItemSchema } from "../server/tally/schemas.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Record contract terms read from one document. Each value must be backed by exact quotes from that document that state it; unproven items are rejected and listed.",
  schema: z.object({
    documentId: z.string().describe("The contract, amendment or note the quotes come from"),
    terms: z.array(termItemSchema).min(1).max(20).describe("Terms found in this document"),
  }),
  deferLoading: false,
  run: async ({ documentId, terms }, ctx) => {
    const owner = ownerOf(ctx);
    const document = await requireDocument(owner, documentId);
    const { grounded, problems } = groundTerms(document, terms);

    const saved = await saveTerms(
      owner,
      document.vendorId,
      grounded.map((item) => item.value),
    );
    if (grounded.length > 0) await markDocument(owner, document.id, "recorded");
    if (problems.length > 0) failWithProblems("terms", saved.saved, problems);

    const kept = saved.keptUserEdits.length > 0 ? ` Kept your edits to ${saved.keptUserEdits.join(", ")}.` : "";
    return {
      id: document.id,
      recorded: saved.saved,
      keptUserEdits: saved.keptUserEdits,
      message: `Recorded ${saved.saved} term${saved.saved === 1 ? "" : "s"} from "${document.name}", each proven by a quote.${kept}`,
      nextRequiredAction: "record-invoices for the vendor's bills, then run-audit",
    };
  },
});
