import { describe, expect, it } from "vitest";

import { type DisputeLine, type Prose, composeDispute, guardProse } from "./dispute-compose";

const lines: DisputeLine[] = [
  { periodStart: "2026-07-01", periodLabel: "July 2026", invoiceNumber: "INV-1041", issue: "Billed twice", explanation: "INV-1041 repeats INV-1040.", amountCents: 125568 },
  { periodStart: "2026-02-01", periodLabel: "February 2026", invoiceNumber: "INV-1034", issue: "Price above contract", explanation: "Billed $26.16; cap $25.20.", amountCents: 3840 },
];

const prose: Prose = {
  subject: "Billing discrepancies on Order Form CW-2025-0207",
  intro: "We reviewed our invoices against the order form and found the charges itemized below.",
  closing: "Please confirm the credit in writing within 15 business days.",
};

describe("composeDispute", () => {
  it("builds the evidence table and total in code, in period order", () => {
    const dispute = composeDispute(lines, prose);
    expect(dispute.totalCents).toBe(129408);
    expect(dispute.tableMd.split("\n")[2]).toContain("February 2026");
    expect(dispute.tableMd).toContain("| **Total** | | | **$1,294.08** |");
    expect(dispute.body).toContain("Total: $1,294.08");
    expect(dispute.body.startsWith(prose.intro)).toBe(true);
  });
});

describe("guardProse", () => {
  it("rejects an amount the code did not compute", () => {
    const result = guardProse({ ...prose, intro: "You owe us $5,000 for these errors." }, lines);
    expect(result.ok).toBe(false);
    expect(result.offending.map((o) => [o.field, o.text])).toEqual([["intro", "$5,000"]]);
  });

  it("allows the computed total and line amounts", () => {
    const result = guardProse({ ...prose, closing: "Please credit $1,294.08, including the $1,255.68 duplicate." }, lines);
    expect(result.ok).toBe(true);
  });
});
