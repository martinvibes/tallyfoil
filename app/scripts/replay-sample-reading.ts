/**
 * Dev tool: record the sample documents without a model, using the scripted
 * reader from the test fixtures, then run the audit. Every value still passes
 * the evidence check, so the result is exactly what a careful agent produces.
 *
 * For UI work and as an offline fallback. Stop the dev server first (PGlite
 * allows one process per data directory):
 *
 *   pnpm replay-sample [owner-email]
 */

import { and, eq } from "drizzle-orm";

import { parseUsageExport } from "../server/audit/usage.js";
import { getDb, schema } from "../server/db/index.js";
import { describeRun, runAudit } from "../server/tally/audit-runner.js";
import { COBALT_TERMS, HALCYON_INVOICE, HALCYON_TERMS, readCobaltInvoice } from "../server/tally/fixtures/sample-agent.js";
import { groundInvoices, groundTerms } from "../server/tally/grounding.js";
import { markDocument, saveInvoices, saveTerms, saveUsageTotals } from "../server/tally/records.js";
import { loadSampleData } from "../server/tally/samples.js";

/** The browser's "Continue as local dev" user. */
const owner = process.argv[2] ?? "dev@local.test";

const main = async () => {
  await loadSampleData(owner);
  const documents = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.ownerEmail, owner), eq(schema.documents.isSample, true)));

  for (const doc of documents) {
    if (doc.kind === "contract" || doc.kind === "amendment") {
      const { grounded, problems } = groundTerms(doc, doc.name.startsWith("cobalt") ? COBALT_TERMS : HALCYON_TERMS);
      if (problems.length > 0) throw new Error(`${doc.name}: ${JSON.stringify(problems)}`);
      await saveTerms(owner, doc.vendorId, grounded.map((g) => g.value));
    } else if (doc.kind === "invoice") {
      const item = doc.name.startsWith("cobalt") ? readCobaltInvoice(doc.text) : HALCYON_INVOICE;
      const { grounded, problems } = groundInvoices(doc, [item]);
      if (problems.length > 0) throw new Error(`${doc.name}: ${JSON.stringify(problems)}`);
      await saveInvoices(owner, doc.vendorId, doc.id, grounded.map((g) => g.value));
    } else if (doc.kind === "usage_export") {
      const parsed = parseUsageExport(doc.text);
      if (!parsed.ok) throw new Error(`${doc.name}: ${parsed.message}`);
      await saveUsageTotals(owner, doc.vendorId, doc.id, parsed.totals);
    }
    await markDocument(owner, doc.id, "recorded");
  }

  const run = await runAudit(owner);
  console.log(`Recorded ${documents.length} sample documents for ${owner}. ${describeRun(run)}`);
};

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
