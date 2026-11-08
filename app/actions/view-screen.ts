import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import { numberedLines, requireDocument } from "../server/tally/records.js";
import { ownerOf } from "../server/tally/session.js";
import { type VendorDetail, getFindingDetail, getOverview, getVendorDetail } from "../server/tally/views.js";

interface Navigation {
  view?: string;
  path?: string;
  vendorId?: string;
  findingId?: string;
  documentId?: string;
  disputeId?: string;
}

interface Selection {
  kind?: "finding" | "term" | "document-range";
  vendorId?: string;
  findingId?: string;
  termId?: string;
  documentId?: string;
  start?: number;
  end?: number;
  label?: string;
}

/** What the agent needs to talk about a vendor, without every bill line. */
const vendorSummary = (detail: VendorDetail) => ({
  vendor: detail.vendor,
  totals: { recoverable: detail.totals.recoverable, atRisk: detail.totals.atRisk, findingCount: detail.totals.findingCount },
  nextDeadline: detail.nextDeadline,
  findingGroups: detail.findingGroups,
  terms: detail.terms.map(({ id, label, meter, value, source, effectiveFrom }) => ({ id, label, meter, value, source, effectiveFrom })),
  rules: detail.rules.filter((rule) => rule.active).map(({ id, description, reason, proof }) => ({ id, description, reason, provenByEmail: proof !== null })),
  documents: detail.documents.map(({ id, name, kind, status }) => ({ id, name, kind, status })),
  invoiceCount: detail.invoices.length,
});

export default defineAction({
  description:
    "Read what the user is looking at right now: the screen, their selection, and the records on it (vendor, finding with proof, or document lines). Call before acting on \"this\".",
  schema: z.object({}),
  http: false,
  readOnly: true,
  deferLoading: false,
  run: async (_args, ctx) => {
    const owner = ownerOf(ctx);
    const navigation = ((await readAppState("navigation")) ?? null) as Navigation | null;
    const selection = ((await readAppState("selection")) ?? null) as Selection | null;
    const screen: Record<string, unknown> = { navigation, selection };

    const vendorId = navigation?.vendorId ?? selection?.vendorId;
    const findingId = selection?.kind === "finding" ? selection.findingId : navigation?.findingId;
    const documentId = selection?.kind === "document-range" ? selection.documentId : navigation?.documentId;

    if (findingId) screen.finding = await getFindingDetail(owner, findingId);
    if (vendorId) screen.vendor = vendorSummary(await getVendorDetail(owner, vendorId));
    if (documentId) {
      const document = await requireDocument(owner, documentId);
      const selected =
        selection?.kind === "document-range" && selection.start !== undefined && selection.end !== undefined
          ? document.text.slice(selection.start, selection.end)
          : null;
      const firstLine = selected === null ? 1 : document.text.slice(0, selection?.start ?? 0).split("\n").length;
      screen.document = {
        id: document.id,
        name: document.name,
        kind: document.kind,
        vendorId: document.vendorId,
        selectedText: selected,
        ...numberedLines(document.text, Math.max(1, firstLine - 5), firstLine + 40),
      };
    }
    if (!navigation || navigation.view === "home") screen.overview = await getOverview(owner);
    return screen;
  },
});
