/**
 * The whole path after the model, on a real (in-memory) Postgres: load the
 * samples, record them through grounding, audit, steer with a rule, re-run.
 */

import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { parseUsageExport } from "../audit/usage";
import { getDb, schema } from "../db/index";
import { MIGRATIONS } from "../db/migrations";
import { runAudit } from "./audit-runner";
import { COBALT_TERMS, HALCYON_INVOICE, HALCYON_TERMS, readCobaltInvoice } from "./fixtures/sample-agent";
import { groundInvoices, groundTerms } from "./grounding";
import { draftDispute } from "./disputes";
import { loadSampleData } from "./samples";
import { addDocument } from "./records";
import { addVendorRule } from "./steering";
import { saveInvoices, saveTerms, saveUsageTotals } from "./records";
import { getFindingDetail, getVendorDetail } from "./views";

const OWNER = "ada@kestrel.test";

beforeAll(async () => {
  process.env.TALLYFOIL_AS_OF = "2026-11-09";
  const db = getDb();
  for (const migration of MIGRATIONS) {
    const statements = String(migration.sql).split(";").map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) await db.execute(sql.raw(statement));
  }
});

const recordEverything = async () => {
  const { vendors } = await loadSampleData(OWNER);
  const documents = await getDb().select().from(schema.documents);
  for (const doc of documents) {
    if (doc.kind === "contract") {
      const terms = doc.name.startsWith("cobalt") ? COBALT_TERMS : HALCYON_TERMS;
      const { grounded, problems } = groundTerms(doc, terms);
      expect(problems, doc.name).toEqual([]);
      await saveTerms(OWNER, doc.vendorId, grounded.map((g) => g.value));
    } else if (doc.kind === "invoice") {
      const item = doc.name.startsWith("cobalt") ? readCobaltInvoice(doc.text) : HALCYON_INVOICE;
      const { grounded, problems } = groundInvoices(doc, [item]);
      expect(problems, doc.name).toEqual([]);
      await saveInvoices(OWNER, doc.vendorId, doc.id, grounded.map((g) => g.value));
    } else if (doc.kind === "usage_export") {
      const parsed = parseUsageExport(doc.text);
      if (!parsed.ok) throw new Error(parsed.message);
      await saveUsageTotals(OWNER, doc.vendorId, doc.id, parsed.totals);
    }
  }
  return vendors;
};

describe("sample audit pipeline", () => {
  let cobaltId = "";

  it("records the samples from quotes and reproduces the expected totals", async () => {
    const vendors = await recordEverything();
    cobaltId = vendors.find((v) => v.name === "Cobalt Workspace")?.id ?? "";

    const run = await runAudit(OWNER);
    expect(run.after).toMatchObject({ recoverableCents: 318024, atRiskCents: 1506816, findingCount: 19, deadlineCount: 1 });
  });

  it("loads the samples once even when asked twice", async () => {
    const { documentsAdded } = await loadSampleData(OWNER);
    expect(documentsAdded).toBe(0);
  });

  it("shows the proof for a price finding: bill row against the contract's cap", async () => {
    const detail = await getVendorDetail(OWNER, cobaltId);
    expect(detail.findingGroups).toHaveLength(4);
    const price = detail.findings.find((f) => f.check === "PRICE_ABOVE_CONTRACT" && f.invoiceNumber === "INV-1034");
    const proof = await getFindingDetail(OWNER, price?.id ?? "");
    expect(proof?.bill[0]?.quotes[0]?.quote).toContain("USD 26.16");
    expect(proof?.agreed.terms.map((t) => t.label)).toEqual(expect.arrayContaining([expect.stringContaining("Renewal increase cap")]));
    expect(detail.timeline.some((notch) => notch.overchargeCents > 0)).toBe(true);
  });

  it("keeps review decisions and explains findings a rule removes", async () => {
    const db = getDb();
    const [duplicate] = await db.select().from(schema.findings).where(sql`${schema.findings.check} = 'DUPLICATE_BILLING'`);
    await db.update(schema.findings).set({ status: "accepted" }).where(sql`${schema.findings.id} = ${duplicate?.id}`);

    await db.insert(schema.vendorRules).values({
      id: "rul_seat48",
      ownerEmail: OWNER,
      vendorId: cobaltId,
      type: "override_term",
      payload: { key: "seat_cap", value: 48, effectiveFrom: "2026-04-01" },
      reason: "We approved 48 seats by email on 28 March 2026.",
      createdBy: "user",
    });
    const run = await runAudit(OWNER);
    expect(run.after.recoverableCents).toBe(176904);
    expect(run.after.acceptedCount).toBe(1);
    expect(run.vendors.find((v) => v.vendorId === cobaltId)?.explainedCount).toBeGreaterThan(0);

    const again = await runAudit(OWNER);
    expect(again.vendors.every((v) => v.opened === 0 && v.resolved === 0)).toBe(true);
    expect(again.after.recoverableCents).toBe(176904);
  });

  it("proves a rule with the approval line from a pasted email", async () => {
    const { document } = await addDocument(OWNER, {
      vendorId: cobaltId,
      kind: "note",
      name: "approval-email.txt",
      text: "From: Ada\nDate: 28 March 2026\n\nApproved: please raise our Cobalt plan to 48 seats from April.\n",
    });
    const { proven } = await addVendorRule(OWNER, {
      vendorId: cobaltId,
      rule: { type: "waive_check", check: "DUPLICATE_BILLING", periodFrom: "2030-01-01", periodTo: "2030-01-01" },
      reason: "test",
      proof: { documentId: document.id, quotes: ["Approved: please raise our Cobalt plan to 48 seats"] },
      createdBy: "user",
    });
    expect(proven).toBe(true);
    await expect(
      addVendorRule(OWNER, {
        vendorId: cobaltId,
        rule: { type: "override_term", key: "seat_cap", value: 50 },
        reason: "test",
        proof: { documentId: document.id, quotes: ["Approved: please raise our Cobalt plan to 48 seats"] },
        createdBy: "user",
      }),
    ).rejects.toMatchObject({ errorCode: "value_not_in_quote" });
  });

  it("blocks a dispute whose prose invents an amount", async () => {
    await expect(
      draftDispute(OWNER, { vendorId: cobaltId, subject: "Billing", intro: "You owe us $5,000.", closing: "Thanks." }),
    ).rejects.toMatchObject({ errorCode: "unverified_amount" });
    const ok = await draftDispute(OWNER, { vendorId: cobaltId, subject: "Billing", intro: "See the charges itemized below.", closing: "Thanks." });
    expect(ok.totalCents).toBeGreaterThan(0);
  });
});
