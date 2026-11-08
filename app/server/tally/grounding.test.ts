import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type InvoiceItem, type TermItem, groundInvoices, groundTerms } from "./grounding";

const sampleDocs = JSON.parse(
  readFileSync(new URL("../../seed/sample-documents.json", import.meta.url), "utf8"),
) as Array<{ name: string; text: string }>;

const doc = (name: string) => {
  const found = sampleDocs.find((d) => d.name === name);
  if (!found) throw new Error(`missing sample ${name}`);
  return { id: `doc_${name}`, text: found.text };
};

const orderForm = doc("cobalt-order-form-CW-2025-0207.pdf");
const july = doc("cobalt-invoice-INV-1040.pdf");
const halcyon = doc("halcyon-invoice-HAI-26-1007.pdf");

const cobaltTerms: TermItem[] = [
  { key: "seat_price", value: "24.00", quotes: ["USD 24.00 per seat per month"] },
  { key: "seat_cap", value: "40", quotes: ["3. Licensed Seats. 40 seats."] },
  { key: "renewal_uplift_cap_bps", value: "5%", quotes: ["no more\n  than 5% over the fees"] },
  { key: "term_start", value: "2025-02-01", quotes: ["Initial Term. February 1, 2025 through January 31, 2026."] },
  { key: "term_end", value: "January 31, 2026", quotes: ["February 1, 2025 through January 31, 2026"] },
  { key: "auto_renew", value: "yes", quotes: ["This Order Form renews automatically"] },
  { key: "notice_days", value: 60, quotes: ["at least\n  60 days before the end"] },
];

describe("groundTerms", () => {
  it("grounds every term of the sample order form and records exact spans", () => {
    const result = groundTerms(orderForm, cobaltTerms);
    expect(result.problems).toEqual([]);
    expect(result.grounded.map(({ value }) => [value.key, value.valueNum ?? value.valueDate])).toEqual([
      ["seat_price", 24_000_000],
      ["seat_cap", 40],
      ["renewal_uplift_cap_bps", 500],
      ["term_start", "2025-02-01"],
      ["term_end", "2026-01-31"],
      ["auto_renew", 1],
      ["notice_days", 60],
    ]);
    const [fragment] = result.grounded[0]!.value.evidence.fragments;
    expect(orderForm.text.slice(fragment!.start, fragment!.end)).toBe("USD 24.00 per seat per month");
  });

  it("reports only the items that fail, by index", () => {
    const result = groundTerms(orderForm, [
      cobaltTerms[0]!,
      { key: "seat_cap", value: "48", quotes: ["40 seats"] },
      { key: "notice_days", value: 90, quotes: ["90 days written notice"] },
      { key: "meter_rate", value: "0.25", quotes: ["USD 24.00 per seat per month"] },
    ]);
    expect(result.grounded.map((g) => g.index)).toEqual([0]);
    expect(result.problems.map((p) => [p.index, p.errorCode])).toEqual([
      [1, "value_not_in_quote"],
      [2, "evidence_not_found"],
      [3, "missing_meter"],
    ]);
  });
});

const julyInvoice: InvoiceItem = {
  invoiceNumber: "INV-1040",
  invoiceDate: "2026-07-06",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  total: "1,255.68",
  totalQuotes: ["Total Due: USD 1,255.68"],
  periodQuotes: ["Billing Period: 2026-07-01 to 2026-07-31"],
  lines: [
    {
      description: "Cobalt Workspace Business - seats",
      quantity: 48,
      unitPrice: "26.16",
      amount: "1,255.68",
      quotes: ["Cobalt Workspace Business - seats 48 USD 26.16 USD 1,255.68"],
    },
  ],
};

const halcyonInvoice: InvoiceItem = {
  invoiceNumber: "HAI-26-1007",
  invoiceDate: "2026-11-03",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  total: "2,571.00",
  totalQuotes: ["Total Due: USD 2,571.00"],
  periodQuotes: ["(October 2026)"],
  lines: [
    ["halcyon-large input", 412_000_000, "3.00", "1,236.00", "halcyon-large input tokens                  412          USD 3.00           USD 1,236.00"],
    ["halcyon-large output", 61_000_000, "15.00", "915.00", "halcyon-large output tokens                   61          USD 15.00           USD 915.00"],
    ["halcyon-small input", 900_000_000, "0.30", "270.00", "halcyon-small input tokens                  900          USD 0.30           USD 270.00"],
    ["halcyon-small output", 120_000_000, "1.25", "150.00", "halcyon-small output tokens                   120          USD 1.25           USD 150.00"],
  ].map(([meter, quantity, unitPrice, amount, quote]) => ({
    description: `${meter} tokens`,
    meter: String(meter),
    quantity: Number(quantity),
    unitPrice: String(unitPrice),
    amount: String(amount),
    quotes: [String(quote)],
  })),
};

describe("groundInvoices", () => {
  it("grounds a seat invoice in engine units", () => {
    const result = groundInvoices(july, [julyInvoice]);
    expect(result.problems).toEqual([]);
    expect(result.grounded[0]!.value).toMatchObject({
      invoiceNumber: "INV-1040",
      totalCents: 125568,
      lines: [{ kind: "seats", quantity: 48, unitPriceMicros: 26_160_000, amountCents: 125568 }],
    });
  });

  it("grounds token counts shown in millions and a period named by month", () => {
    const result = groundInvoices(halcyon, [halcyonInvoice]);
    expect(result.problems).toEqual([]);
    expect(result.grounded[0]!.value.lines.map((l) => [l.kind, l.meter, l.quantity])).toEqual([
      ["usage", "halcyon-large input", 412_000_000],
      ["usage", "halcyon-large output", 61_000_000],
      ["usage", "halcyon-small input", 900_000_000],
      ["usage", "halcyon-small output", 120_000_000],
    ]);
  });

  it("catches token counts given in millions instead of tokens", () => {
    const line = { ...halcyonInvoice.lines[0]!, quantity: 412 };
    const result = groundInvoices(halcyon, [{ ...halcyonInvoice, lines: [line, ...halcyonInvoice.lines.slice(1)] }]);
    expect(result.problems).toEqual([expect.objectContaining({ index: 0, errorCode: "line_math_mismatch" })]);
  });

  it("rejects lines that do not add up to the total", () => {
    const result = groundInvoices(halcyon, [{ ...halcyonInvoice, lines: halcyonInvoice.lines.slice(1) }]);
    expect(result.problems).toEqual([expect.objectContaining({ errorCode: "lines_do_not_sum" })]);
  });

  it("rejects an invoice number or date that is not in the document", () => {
    const wrongNumber = groundInvoices(july, [{ ...julyInvoice, invoiceNumber: "INV-9999" }]);
    expect(wrongNumber.problems).toEqual([expect.objectContaining({ errorCode: "evidence_not_found" })]);
    const wrongDate = groundInvoices(july, [{ ...julyInvoice, invoiceDate: "2026-07-07" }]);
    expect(wrongDate.problems).toEqual([expect.objectContaining({ errorCode: "evidence_not_found" })]);
  });
});
