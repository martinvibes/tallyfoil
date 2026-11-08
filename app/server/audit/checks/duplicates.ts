/**
 * DUPLICATE_BILLING: two invoices for the same period with the same total.
 * The later one (by date, then number) is the duplicate; it is excluded from
 * every other check so the same seats are never counted twice.
 */

import { periodLabel } from "../dates";
import { Evidence, buildFinding } from "../findings";
import { formatCents, formatUsd } from "../money";
import type { Finding, InvoiceInput } from "../types";
import type { CheckContext } from "./context";

/** Maps each duplicate invoice's id to the invoice it repeats. Expects billing order. */
export const findDuplicates = (invoices: readonly InvoiceInput[]): Map<string, InvoiceInput> => {
  const originals = new Map<string, InvoiceInput>();
  const duplicates = new Map<string, InvoiceInput>();

  for (const invoice of invoices) {
    if (invoice.totalCents <= 0) continue;
    const key = `${invoice.periodStart}|${invoice.periodEnd}|${invoice.totalCents}`;
    const original = originals.get(key);
    if (original) duplicates.set(invoice.id, original);
    else originals.set(key, invoice);
  }
  return duplicates;
};

export const duplicateFinding = (ctx: CheckContext, invoice: InvoiceInput, original: InvoiceInput): Finding =>
  buildFinding(ctx.vendor.id, {
    check: "DUPLICATE_BILLING",
    title: "Duplicate invoice",
    explanation:
      `${invoice.invoiceNumber} bills ${periodLabel(invoice.periodStart, invoice.periodEnd)} for ` +
      `${formatUsd(invoice.totalCents)}, the same period and total as ${original.invoiceNumber}.`,
    amountCents: invoice.totalCents,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    invoiceNumber: invoice.invoiceNumber,
    math: {
      formula: "total of the duplicate invoice",
      duplicates: original.invoiceNumber,
      result: formatCents(invoice.totalCents),
    },
    evidence: new Evidence().invoice(invoice.id, original.id),
  });
