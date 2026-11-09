import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { formatUsd } from "../server/audit/money.js";
import { draftDispute } from "../server/tally/disputes.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Draft a dispute email for a vendor. You write only the subject, intro and closing — no amounts; code adds the itemized evidence table and total, and a number guard rejects any amount it didn't compute.",
  schema: z.object({
    vendorId: z.string().describe("Vendor to dispute"),
    findingIds: z.array(z.string()).optional().describe("Findings to include; default is accepted findings plus open breaches"),
    subject: z.string().min(1).max(200).describe("Email subject; name the order form or contract number"),
    intro: z.string().min(1).max(4000).describe("Opening paragraph(s): who we are, which contract, what we ask for. Refer to 'the charges itemized below'"),
    closing: z.string().min(1).max(4000).describe("Closing: ask for written confirmation and a credit date; offer to walk through the evidence"),
  }),
  deferLoading: false,
  run: async (args, ctx) => {
    const dispute = await draftDispute(ownerOf(ctx), args);
    return {
      id: dispute.id,
      total: formatUsd(dispute.totalCents),
      findingCount: dispute.findingCount,
      message: `Drafted a dispute to ${dispute.vendorName} for ${formatUsd(dispute.totalCents)} across ${dispute.findingCount} findings.`,
      nextRequiredAction: "navigate to the dispute (view dispute) so the user can edit and approve it",
    };
  },
});
