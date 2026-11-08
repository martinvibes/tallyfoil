import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ownerOf } from "../server/tally/session.js";
import { getVendorDetail } from "../server/tally/views.js";

export default defineAction({
  description:
    "One vendor's workspace: recorded terms with their quotes, rules, documents and status, invoices with lines, usage totals, findings grouped by check, and the monthly tally.",
  schema: z.object({
    vendorId: z.string().describe("Vendor id"),
  }),
  http: { method: "GET" },
  deferLoading: false,
  run: async ({ vendorId }, ctx) => getVendorDetail(ownerOf(ctx), vendorId),
});
