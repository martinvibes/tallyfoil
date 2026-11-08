import { describe, expect, it } from "vitest";

import { locateQuote, matchEvidence } from "./evidence";

const ORDER_FORM = [
  "Order Form",
  "Order Form effective date: February 1, 2025",
  "",
  "1. Initial Term. February 1, 2025 through January 31, 2026.",
  "",
  "2. Subscription Fee. USD 24.00 per seat per month, billed monthly in advance.",
  "",
  "3. Licensed Seats. 40 seats. Customer may not exceed 40 seats without a",
  "  mutually executed Order Form or Customer’s written approval.",
  "",
  "4. Renewal. This Order Form renews automatically for successive 12-month",
  "  terms unless either party gives written notice of non-renewal at least",
  "  60 days before the end of the then-current term.",
  "",
  "5. Price Changes. On renewal, Cobalt may increase per-seat fees by no more",
  "  than 5% over the fees in effect during the immediately preceding term.",
].join("\n");

const INVOICE = [
  "Invoice No.: INV-1040",
  "Invoice Date: 2026-07-06",
  "Description                             Qty     Unit Price        Amount",
  "Cobalt Workspace Business - seats                     48      USD 26.16              USD 1,255.68",
  "Total Due: USD 1,255.68",
].join("\n");

const TOKEN_INVOICE = [
  "Description                         Tokens (M) Rate per 1M                Amount",
  "halcyon-large input tokens                  412          USD 3.00           USD 1,236.00",
].join("\n");

describe("locateQuote", () => {
  it("returns offsets that slice the original text", () => {
    const hit = locateQuote(ORDER_FORM, "USD 24.00 per seat per month");
    expect(hit).not.toBeNull();
    expect(ORDER_FORM.slice(hit!.start, hit!.end)).toBe("USD 24.00 per seat per month");
  });

  it("ignores differences in whitespace and case", () => {
    const hit = locateQuote(INVOICE, "cobalt workspace business - seats 48 USD 26.16");
    expect(hit).not.toBeNull();
    expect(INVOICE.slice(hit!.start, hit!.end)).toMatch(/^Cobalt Workspace Business - seats\s+48\s+USD 26\.16$/);
  });

  it("treats curly and straight apostrophes as the same", () => {
    expect(locateQuote(ORDER_FORM, "Customer's written approval")).not.toBeNull();
  });

  it("matches a quote that spans a line break", () => {
    expect(locateQuote(ORDER_FORM, "at least 60 days before the end")).not.toBeNull();
  });

  it("strips a read-document line-number prefix from the quote", () => {
    expect(locateQuote(ORDER_FORM, "6 | 2. Subscription Fee. USD 24.00 per seat")).not.toBeNull();
  });

  it("returns null when the quote is not in the document", () => {
    expect(locateQuote(ORDER_FORM, "USD 22.00 per seat per month")).toBeNull();
  });
});

describe("matchEvidence", () => {
  it("accepts a unit price that appears in its quote", () => {
    const result = matchEvidence(ORDER_FORM, [{ quote: "USD 24.00 per seat per month" }], {
      kind: "decimal",
      micros: 24_000_000,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a quote that is not in the document", () => {
    const result = matchEvidence(ORDER_FORM, [{ quote: "USD 22.00 per seat per month" }], {
      kind: "decimal",
      micros: 22_000_000,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "evidence_not_found" });
  });

  it("rejects a value that the quote does not contain", () => {
    const result = matchEvidence(ORDER_FORM, [{ quote: "USD 24.00 per seat per month" }], {
      kind: "decimal",
      micros: 25_000_000,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "value_not_in_quote" });
  });

  it("compares whole numbers, not digits inside a longer number", () => {
    const result = matchEvidence(INVOICE, [{ quote: "USD 1,255.68" }], {
      kind: "decimal",
      micros: 255_680_000,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "value_not_in_quote" });
  });

  it("accepts a table row split across two fragments", () => {
    const result = matchEvidence(
      TOKEN_INVOICE,
      [{ quote: "halcyon-large input tokens" }, { quote: "USD 3.00" }],
      { kind: "decimal", micros: 3_000_000 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fragments).toHaveLength(2);
  });

  it("accepts money with or without decimals and separators", () => {
    expect(matchEvidence(INVOICE, [{ quote: "Total Due: USD 1,255.68" }], { kind: "money", cents: 125568 }).ok).toBe(true);
    expect(matchEvidence("Total: USD 960", [{ quote: "USD 960" }], { kind: "money", cents: 96000 }).ok).toBe(true);
  });

  it("accepts token counts shown in millions when the document says (M)", () => {
    const result = matchEvidence(TOKEN_INVOICE, [{ quote: "halcyon-large input tokens 412" }], {
      kind: "integer",
      value: 412_000_000,
    });
    expect(result.ok).toBe(true);
  });

  it("does not scale by a million when the document never says so", () => {
    const plain = "halcyon-large input tokens 412";
    const result = matchEvidence(plain, [{ quote: plain }], { kind: "integer", value: 412_000_000 });
    expect(result).toMatchObject({ ok: false, errorCode: "value_not_in_quote" });
  });

  it("accepts percentages written as digits or words", () => {
    expect(matchEvidence(ORDER_FORM, [{ quote: "by no more than 5% over the fees" }], { kind: "percent", bps: 500 }).ok).toBe(true);
    expect(matchEvidence("capped at five percent", [{ quote: "five percent" }], { kind: "percent", bps: 500 }).ok).toBe(true);
    expect(matchEvidence(ORDER_FORM, [{ quote: "by no more than 5% over the fees" }], { kind: "percent", bps: 900 }).ok).toBe(false);
  });

  it("accepts dates written as ISO or in words", () => {
    expect(matchEvidence(ORDER_FORM, [{ quote: "through January 31, 2026" }], { kind: "date", iso: "2026-01-31" }).ok).toBe(true);
    expect(matchEvidence(INVOICE, [{ quote: "Invoice Date: 2026-07-06" }], { kind: "date", iso: "2026-07-06" }).ok).toBe(true);
    expect(matchEvidence("starts 1 July 2026", [{ quote: "1 July 2026" }], { kind: "date", iso: "2026-07-01" }).ok).toBe(true);
    expect(matchEvidence(ORDER_FORM, [{ quote: "through January 31, 2026" }], { kind: "date", iso: "2026-01-30" }).ok).toBe(false);
  });

  it("accepts presence-only values when every quote is found", () => {
    const result = matchEvidence(ORDER_FORM, [{ quote: "renews automatically" }], { kind: "presence" });
    expect(result.ok).toBe(true);
  });

  it("requires between one and three fragments", () => {
    expect(matchEvidence(ORDER_FORM, [], { kind: "presence" })).toMatchObject({ ok: false, errorCode: "invalid_fragments" });
    const four = Array.from({ length: 4 }, () => ({ quote: "Order Form" }));
    expect(matchEvidence(ORDER_FORM, four, { kind: "presence" })).toMatchObject({ ok: false, errorCode: "invalid_fragments" });
  });
});
