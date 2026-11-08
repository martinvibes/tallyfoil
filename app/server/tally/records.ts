/**
 * Reads and writes of the recorded facts: vendors, documents, terms,
 * invoices and usage totals. Every query is scoped to the owner.
 */

import { createHash } from "node:crypto";

import { fail } from "@agent-native/core/action";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { VendorKind } from "../audit/types.js";
import type { UsageTotal } from "../audit/usage.js";
import { getDb, schema } from "../db/index.js";
import type { DocumentKind } from "../db/schema.js";
import type { GroundedInvoice, GroundedTerm } from "./grounding.js";
import { newId, nowTimestamp } from "./session.js";

export type VendorRow = typeof schema.vendors.$inferSelect;
export type DocumentRow = typeof schema.documents.$inferSelect;

/** `WHERE owner_email = ? AND vendor_id = ?` for any vendor-owned table. */
export const ofVendor = (table: { ownerEmail: AnyPgColumn; vendorId: AnyPgColumn }, owner: string, vendorId: string) =>
  and(eq(table.ownerEmail, owner), eq(table.vendorId, vendorId));

export const requireVendor = async (owner: string, vendorId: string): Promise<VendorRow> => {
  const [vendor] = await getDb()
    .select()
    .from(schema.vendors)
    .where(and(eq(schema.vendors.ownerEmail, owner), eq(schema.vendors.id, vendorId)));
  if (!vendor) fail(`No vendor with id "${vendorId}". Call get-overview to list vendors.`, { errorCode: "vendor_not_found", statusCode: 404 });
  return vendor;
};

export interface NewVendor {
  name: string;
  kind: VendorKind;
  isSample?: boolean;
}

/** Creates the vendor, or returns the one of the same name (case-insensitive) the user already has. */
export const ensureVendor = async (owner: string, input: NewVendor): Promise<{ vendor: VendorRow; created: boolean }> => {
  const db = getDb();
  const name = input.name.trim();
  const existing = (await db.select().from(schema.vendors).where(eq(schema.vendors.ownerEmail, owner))).find(
    (vendor) => vendor.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return { vendor: existing, created: false };

  const [vendor] = await db
    .insert(schema.vendors)
    .values({ id: newId("ven"), ownerEmail: owner, name, kind: input.kind, isSample: input.isSample ?? false })
    .returning();
  if (!vendor) fail("Could not create the vendor.", { errorCode: "write_failed", statusCode: 500 });
  return { vendor, created: true };
};

export const requireDocument = async (owner: string, documentId: string): Promise<DocumentRow> => {
  const [document] = await getDb()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.ownerEmail, owner), eq(schema.documents.id, documentId)));
  if (!document) fail(`No document with id "${documentId}". Call get-vendor to list documents.`, { errorCode: "document_not_found", statusCode: 404 });
  return document;
};

export const markDocument = async (owner: string, documentId: string, status: DocumentRow["status"]) => {
  await getDb()
    .update(schema.documents)
    .set({ status })
    .where(and(eq(schema.documents.ownerEmail, owner), eq(schema.documents.id, documentId)));
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface NewDocument {
  vendorId: string;
  kind: DocumentKind;
  name: string;
  text: string;
  isSample?: boolean;
}

/** Stores extracted text once per vendor; re-adding the same text returns the existing document. */
export const addDocument = async (owner: string, input: NewDocument): Promise<{ document: DocumentRow; duplicate: boolean }> => {
  const db = getDb();
  const sha256 = createHash("sha256").update(input.text).digest("hex");
  const [existing] = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.ownerEmail, owner), eq(schema.documents.vendorId, input.vendorId), eq(schema.documents.sha256, sha256)));
  if (existing) return { document: existing, duplicate: true };

  const [document] = await db
    .insert(schema.documents)
    .values({
      id: newId("doc"),
      ownerEmail: owner,
      vendorId: input.vendorId,
      kind: input.kind,
      name: input.name.trim(),
      text: input.text,
      sha256,
      isSample: input.isSample ?? false,
    })
    .returning();
  if (!document) fail("Could not store the document.", { errorCode: "write_failed", statusCode: 500 });
  return { document, duplicate: false };
};

/** "12 | line text" — the format the evidence matcher strips from quotes. */
export const numberedLines = (text: string, fromLine: number, toLine: number) => {
  const lines = text.split(/\r?\n/);
  const from = Math.max(1, fromLine);
  const to = Math.min(lines.length, toLine);
  return {
    totalLines: lines.length,
    fromLine: from,
    toLine: to,
    text: lines
      .slice(from - 1, to)
      .map((line, i) => `${from + i} | ${line}`)
      .join("\n"),
  };
};

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export interface SaveTermsResult {
  saved: number;
  keptUserEdits: string[];
}

/**
 * Upserts terms by (key, meter, effectiveFrom). A term the user corrected
 * by hand is never overwritten by a re-read.
 */
export const saveTerms = async (owner: string, vendorId: string, grounded: readonly GroundedTerm[]): Promise<SaveTermsResult> => {
  const db = getDb();
  const result: SaveTermsResult = { saved: 0, keptUserEdits: [] };

  for (const term of grounded) {
    const [existing] = await db
      .select()
      .from(schema.terms)
      .where(
        and(
          eq(schema.terms.ownerEmail, owner),
          eq(schema.terms.vendorId, vendorId),
          eq(schema.terms.key, term.key),
          term.meter ? eq(schema.terms.meter, term.meter) : isNull(schema.terms.meter),
          term.effectiveFrom ? eq(schema.terms.effectiveFrom, term.effectiveFrom) : isNull(schema.terms.effectiveFrom),
        ),
      );

    if (existing?.source === "user") {
      result.keptUserEdits.push(term.meter ? `${term.key} (${term.meter})` : term.key);
      continue;
    }

    const values = {
      valueNum: term.valueNum,
      valueText: term.valueText,
      valueDate: term.valueDate,
      effectiveTo: term.effectiveTo,
      evidence: term.evidence,
      source: "agent" as const,
      updatedAt: nowTimestamp(),
    };
    if (existing) {
      await db
        .update(schema.terms)
        .set({ ...values, revision: existing.revision + 1 })
        .where(and(eq(schema.terms.ownerEmail, owner), eq(schema.terms.id, existing.id)));
    } else {
      await db.insert(schema.terms).values({
        ...values,
        id: newId("trm"),
        ownerEmail: owner,
        vendorId,
        key: term.key,
        meter: term.meter,
        effectiveFrom: term.effectiveFrom,
      });
    }
    result.saved++;
  }
  return result;
};

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/** Upserts invoices by number and replaces their lines. */
export const saveInvoices = async (
  owner: string,
  vendorId: string,
  documentId: string,
  grounded: readonly GroundedInvoice[],
): Promise<string[]> => {
  const db = getDb();
  const ids: string[] = [];

  for (const invoice of grounded) {
    const [existing] = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.ownerEmail, owner),
          eq(schema.invoices.vendorId, vendorId),
          eq(schema.invoices.invoiceNumber, invoice.invoiceNumber),
        ),
      );

    const fields = {
      documentId,
      invoiceDate: invoice.invoiceDate,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      totalCents: invoice.totalCents,
      evidence: invoice.evidence,
    };
    const invoiceId = existing?.id ?? newId("inv");
    if (existing) {
      await db.update(schema.invoices).set(fields).where(and(eq(schema.invoices.ownerEmail, owner), eq(schema.invoices.id, invoiceId)));
      await db
        .delete(schema.invoiceLines)
        .where(and(eq(schema.invoiceLines.ownerEmail, owner), eq(schema.invoiceLines.invoiceId, invoiceId)));
    } else {
      await db.insert(schema.invoices).values({ ...fields, id: invoiceId, ownerEmail: owner, vendorId, invoiceNumber: invoice.invoiceNumber });
    }

    await db.insert(schema.invoiceLines).values(
      invoice.lines.map((line) => ({
        id: newId("lin"),
        ownerEmail: owner,
        invoiceId,
        position: line.position,
        kind: line.kind,
        description: line.description,
        meter: line.meter,
        quantity: line.quantity,
        unitPriceMicros: line.unitPriceMicros,
        amountCents: line.amountCents,
        evidence: line.evidence,
      })),
    );
    ids.push(invoiceId);
  }
  return ids;
};

// ---------------------------------------------------------------------------
// Usage totals
// ---------------------------------------------------------------------------

/** Replaces the totals parsed from one usage export. */
export const saveUsageTotals = async (owner: string, vendorId: string, documentId: string, totals: readonly UsageTotal[]) => {
  const db = getDb();
  await db
    .delete(schema.usageTotals)
    .where(and(eq(schema.usageTotals.ownerEmail, owner), eq(schema.usageTotals.documentId, documentId)));
  if (totals.length === 0) return;
  await db.insert(schema.usageTotals).values(
    totals.map((total) => ({ id: newId("use"), ownerEmail: owner, vendorId, documentId, ...total })),
  );
};

/** Invoice lines for a set of invoices, in invoice order then position. */
export const linesFor = async (owner: string, invoiceIds: readonly string[]) =>
  invoiceIds.length === 0
    ? []
    : getDb()
        .select()
        .from(schema.invoiceLines)
        .where(and(eq(schema.invoiceLines.ownerEmail, owner), inArray(schema.invoiceLines.invoiceId, [...invoiceIds])))
        .orderBy(asc(schema.invoiceLines.invoiceId), asc(schema.invoiceLines.position));
