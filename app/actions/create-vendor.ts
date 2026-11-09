import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ensureVendor } from "../server/tally/records.js";
import { ensureRenewalWatch } from "../server/tally/renewal-watch.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description: "Create a vendor to audit (or return the existing vendor with that name).",
  schema: z.object({
    name: z.string().min(1).max(120).describe('Vendor name as it appears on their bills, e.g. "Cobalt Workspace"'),
    kind: z
      .enum(["seat_subscription", "usage_metered"])
      .describe("seat_subscription for per-seat SaaS, usage_metered for AI/API usage billing"),
  }),
  run: async ({ name, kind }, ctx) => {
    const { vendor, created } = await ensureVendor(ownerOf(ctx), { name, kind });
    await ensureRenewalWatch(ownerOf(ctx));
    return {
      id: vendor.id,
      vendor: { id: vendor.id, name: vendor.name, kind: vendor.kind },
      created,
      message: created ? `Created vendor ${vendor.name}.` : `${vendor.name} already exists.`,
      nextRequiredAction: "add-document",
    };
  },
});
