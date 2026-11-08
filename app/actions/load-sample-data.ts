import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadSampleData } from "../server/tally/samples.js";
import { ownerOf } from "../server/tally/session.js";

export default defineAction({
  description:
    "Load the labeled sample set (fictional vendors Cobalt Workspace and Halcyon AI with 17 documents). Documents only: you still read and record them.",
  schema: z.object({}),
  run: async (_args, ctx) => {
    const { vendors, documentsAdded } = await loadSampleData(ownerOf(ctx));
    return {
      id: vendors[0]?.id ?? "",
      vendors,
      documentsAdded,
      message:
        documentsAdded > 0
          ? `Loaded ${documentsAdded} sample documents for ${vendors.map((v) => v.name).join(" and ")}. This is sample data.`
          : "The sample documents are already loaded.",
      nextRequiredAction: "get-vendor for each sample vendor, then read and record its documents",
    };
  },
});
