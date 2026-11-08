/**
 * The labeled sample set: two fictional vendors and their documents, as
 * already-extracted text. Loading it records documents only; the agent
 * still reads them and records terms and bills live.
 */

import { eq } from "drizzle-orm";

import type { VendorKind } from "../audit/types.js";
import { getDb, schema } from "../db/index.js";
import type { DocumentKind } from "../db/schema.js";
import sampleDocuments from "../../seed/sample-documents.json";
import { addDocument, ensureVendor } from "./records.js";

const SAMPLE_VENDORS: ReadonlyArray<{ name: string; kind: VendorKind }> = [
  { name: "Cobalt Workspace", kind: "seat_subscription" },
  { name: "Halcyon AI", kind: "usage_metered" },
];

interface SampleDocument {
  vendor: string;
  kind: DocumentKind;
  name: string;
  text: string;
}

export const loadSampleData = async (owner: string) => {
  const vendors = [];
  let documentsAdded = 0;

  for (const sample of SAMPLE_VENDORS) {
    const { vendor } = await ensureVendor(owner, { ...sample, isSample: true });
    const documents = (sampleDocuments as SampleDocument[]).filter((doc) => doc.vendor === sample.name);
    for (const doc of documents) {
      const { duplicate } = await addDocument(owner, { vendorId: vendor.id, kind: doc.kind, name: doc.name, text: doc.text, isSample: true });
      if (!duplicate) documentsAdded++;
    }
    vendors.push({ id: vendor.id, name: vendor.name, kind: vendor.kind, documentCount: documents.length });
  }
  return { vendors, documentsAdded };
};

/** Deletes everything the user has in Tallyfoil. */
export const resetAllData = async (owner: string) => {
  const db = getDb();
  const tables = [
    schema.disputes,
    schema.findings,
    schema.auditRuns,
    schema.vendorRules,
    schema.usageTotals,
    schema.invoiceLines,
    schema.invoices,
    schema.terms,
    schema.documents,
    schema.vendors,
  ];
  for (const table of tables) await db.delete(table).where(eq(table.ownerEmail, owner));
};
