/**
 * Test fixture: a scripted stand-in for the agent. It "reads" the sample
 * documents with fixed quotes and regexes and proposes the items the real
 * agent would, so the pipeline after the model can be tested end to end.
 */

import sampleDocuments from "../../../seed/sample-documents.json";
import type { InvoiceItem, TermItem } from "../grounding.js";

export interface SampleDoc {
  vendor: string;
  kind: string;
  name: string;
  text: string;
}

export const SAMPLE_DOCS = sampleDocuments as SampleDoc[];

export const sampleDoc = (name: string) => {
  const found = SAMPLE_DOCS.find((doc) => doc.name === name);
  if (!found) throw new Error(`missing sample ${name}`);
  return { id: `doc_${name}`, text: found.text };
};

export const COBALT_TERMS: TermItem[] = [
  { key: "seat_price", value: "24.00", quotes: ["USD 24.00 per seat per month"] },
  { key: "seat_cap", value: "40", quotes: ["3. Licensed Seats. 40 seats."] },
  { key: "renewal_uplift_cap_bps", value: "5%", quotes: ["no more\n  than 5% over the fees"] },
  { key: "term_start", value: "2025-02-01", quotes: ["Initial Term. February 1, 2025 through January 31, 2026."] },
  { key: "term_end", value: "January 31, 2026", quotes: ["February 1, 2025 through January 31, 2026"] },
  { key: "auto_renew", value: "yes", quotes: ["This Order Form renews automatically"] },
  { key: "notice_days", value: 60, quotes: ["at least\n  60 days before the end"] },
];

export const HALCYON_TERMS: TermItem[] = [
  { key: "meter_rate", meter: "halcyon-large input", value: "3.00", quotes: ["halcyon-large: input USD 3.00 per 1M tokens"] },
  { key: "meter_rate", meter: "halcyon-large output", value: "15.00", quotes: ["output USD 15.00 per 1M tokens"] },
  { key: "meter_rate", meter: "halcyon-small input", value: "0.25", quotes: ["halcyon-small: input USD 0.25 per 1M tokens"] },
  { key: "meter_rate", meter: "halcyon-small output", value: "1.25", quotes: ["output USD 1.25 per 1M tokens"] },
  { key: "billing_basis", value: "usage_export", quotes: ["Billable usage equals the token counts shown in the"] },
];

const halcyonLine = (meter: string, millions: number, unitPrice: string, amount: string, quote: string) => ({
  description: `${meter} tokens`,
  meter,
  quantity: millions * 1_000_000,
  unitPrice,
  amount,
  quotes: [quote],
});

export const HALCYON_INVOICE: InvoiceItem = {
  invoiceNumber: "HAI-26-1007",
  invoiceDate: "2026-11-03",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  total: "2,571.00",
  totalQuotes: ["Total Due: USD 2,571.00"],
  periodQuotes: ["(October 2026)"],
  lines: [
    halcyonLine("halcyon-large input", 412, "3.00", "1,236.00", "halcyon-large input tokens                  412          USD 3.00           USD 1,236.00"),
    halcyonLine("halcyon-large output", 61, "15.00", "915.00", "halcyon-large output tokens                   61          USD 15.00           USD 915.00"),
    halcyonLine("halcyon-small input", 900, "0.30", "270.00", "halcyon-small input tokens                  900          USD 0.30           USD 270.00"),
    halcyonLine("halcyon-small output", 120, "1.25", "150.00", "halcyon-small output tokens                   120          USD 1.25           USD 150.00"),
  ],
};

const must = (match: RegExpMatchArray | null, what: string): RegExpMatchArray => {
  if (!match) throw new Error(`scripted reader could not find ${what}`);
  return match;
};

/** Reads one Cobalt seat invoice the way the agent is told to: every value quoted from the text. */
export const readCobaltInvoice = (text: string): InvoiceItem => {
  const number = must(text.match(/Invoice No\.: (\S+)/), "invoice number");
  const date = must(text.match(/Invoice Date: (\d{4}-\d{2}-\d{2})/), "invoice date");
  const period = must(text.match(/Billing Period: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/), "billing period");
  const total = must(text.match(/Total Due: USD ([\d,.]+)/), "total");
  const rows = [...text.matchAll(/^(Cobalt Workspace [^\n]*?)\s{2,}(\d+)\s+USD ([\d,.]+)\s+USD ([\d,.]+)$/gm)];
  if (rows.length === 0) throw new Error("scripted reader found no seat lines");

  return {
    invoiceNumber: number[1] ?? "",
    invoiceDate: date[1] ?? "",
    periodStart: period[1] ?? "",
    periodEnd: period[2] ?? "",
    total: total[1] ?? "",
    totalQuotes: [total[0]],
    periodQuotes: [period[0]],
    lines: rows.map((row) => ({
      description: row[1] ?? "",
      quantity: Number(row[2]),
      unitPrice: row[3] ?? "",
      amount: row[4] ?? "",
      quotes: [row[0]],
    })),
  };
};
