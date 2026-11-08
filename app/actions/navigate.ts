import { defineAction, fail } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { ownerOf } from "../server/tally/session.js";
import { type TallyLocation, pathForLocation } from "../shared/routes.js";

const vendorOfFinding = async (owner: string, findingId: string) => {
  const [row] = await getDb()
    .select({ vendorId: schema.findings.vendorId })
    .from(schema.findings)
    .where(and(eq(schema.findings.ownerEmail, owner), eq(schema.findings.id, findingId)));
  if (!row) fail(`No finding with id "${findingId}".`, { errorCode: "finding_not_found", statusCode: 404 });
  return row.vendorId;
};

export default defineAction({
  description:
    "Move the user's screen: the overview (home), a vendor, a finding's evidence, a document, a dispute, or chat.",
  schema: z.object({
    view: z.enum(["home", "vendor", "finding", "document", "dispute", "chat"]).describe("Screen to show"),
    vendorId: z.string().optional().describe("For view vendor"),
    findingId: z.string().optional().describe("For view finding"),
    documentId: z.string().optional().describe("For view document"),
    disputeId: z.string().optional().describe("For view dispute"),
    threadId: z.string().optional().describe("For view chat: thread to open"),
  }),
  http: false,
  deferLoading: false,
  run: async ({ view, vendorId, findingId, documentId, disputeId, threadId }, ctx) => {
    const command: Record<string, string> = { view };
    if (view === "chat") {
      if (threadId) command.threadId = threadId;
    } else {
      const location: TallyLocation = { view };
      if (vendorId) location.vendorId = vendorId;
      if (findingId) {
        location.findingId = findingId;
        location.vendorId = vendorId ?? (await vendorOfFinding(ownerOf(ctx), findingId));
      }
      if (documentId) location.documentId = documentId;
      if (disputeId) location.disputeId = disputeId;
      command.path = pathForLocation(location);
      Object.assign(command, location);
    }
    command._writeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeAppStateForCurrentTab("navigate", command);
    return { message: `Showing ${command.path ?? "chat"}.` };
  },
});
