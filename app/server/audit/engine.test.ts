import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { audit } from "./engine";
import type { AuditInput, AuditOutput, CheckCode, Finding, RuleInput, TermKey } from "./types";

// ---------------------------------------------------------------------------
// Sample set → engine input
// ---------------------------------------------------------------------------

const readSeed = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../seed/${name}`, import.meta.url), "utf8")) as T;

interface SeedVendor {
  id: string;
  name: string;
  kind: AuditInput["vendor"]["kind"];
  terms: Array<{ key: TermKey; meter?: string; valueNum?: number; valueText?: string; valueDate?: string }>;
  invoices: Array<Omit<AuditInput["invoices"][number], "id" | "lines"> & { lines: Array<Omit<AuditInput["invoices"][number]["lines"][number], "id">> }>;
  usageTotals: Array<Omit<AuditInput["usageTotals"][number], "id">>;
}

interface SeedStructured {
  asOf: string;
  vendors: SeedVendor[];
  rulesForAfterScenario: Array<{ vendorId: string; type: "override_term"; payload: { key: TermKey; value: number; effectiveFrom: string } }>;
}

const sample = readSeed<SeedStructured>("sample-structured.json");
const expected = readSeed<{
  beforeRule: { recoverableCents: number; byCheckCents: Record<string, number>; findings: ExpectedFinding[]; deadline: ExpectedDeadline };
  afterRule_seatCap48FromApril2026: { recoverableCents: number; byCheckCents: Record<string, number>; findings: ExpectedFinding[]; deadline: ExpectedDeadline };
}>("expected-findings.json");

type ExpectedFinding = Record<string, string | number>;
type ExpectedDeadline = { check: string; vendor: string; termEnd: string; noticeDays: number; noticeDeadline: string; atRiskCents: number; severity: string };

const toInput = (vendor: SeedVendor, rules: RuleInput[] = []): AuditInput => ({
  vendor: { id: vendor.id, name: vendor.name, kind: vendor.kind },
  terms: vendor.terms.map((term, i) => ({ id: `${vendor.id}_t${i}`, source: "agent", ...term })),
  rules,
  invoices: vendor.invoices.map((invoice) => ({
    ...invoice,
    id: `${vendor.id}_${invoice.invoiceNumber}`,
    lines: invoice.lines.map((line, i) => ({ ...line, id: `${vendor.id}_${invoice.invoiceNumber}_l${i}` })),
  })),
  usageTotals: vendor.usageTotals.map((usage, i) => ({ ...usage, id: `${vendor.id}_u${i}` })),
});

const seatCapRule: RuleInput = { id: "rule_seats48", type: "override_term", payload: sample.rulesForAfterScenario[0]!.payload };

const runSample = (rules: RuleInput[] = [], asOf = sample.asOf) =>
  sample.vendors.map((vendor) => audit(toInput(vendor, rules), asOf));

// ---------------------------------------------------------------------------
// Engine output → the shape used in expected-findings.json
// ---------------------------------------------------------------------------

const MATH_FIELDS: Partial<Record<CheckCode, string[]>> = {
  PRICE_ABOVE_CONTRACT: ["billedUnit", "allowedUnit", "qty"],
  SEAT_CAP_EXCEEDED: ["billedSeats", "cap"],
  DUPLICATE_BILLING: ["duplicates"],
  USAGE_OVERBILLED: ["meter", "billed", "logged"],
  RATE_ABOVE_CONTRACT: ["meter", "billedRate", "contractRate"],
};

const vendorName = (vendorId: string) => sample.vendors.find((v) => v.id === vendorId)!.name;

const asExpected = (f: Finding): ExpectedFinding => ({
  check: f.check,
  vendor: vendorName(f.vendorId),
  period: f.periodLabel,
  invoice: f.invoiceNumber ?? "",
  ...Object.fromEntries((MATH_FIELDS[f.check] ?? []).map((field) => [field, f.math[field]])),
  amountCents: f.amountCents,
  severity: f.severity,
});

const recoverable = (outputs: AuditOutput[]) => outputs.reduce((sum, o) => sum + o.totals.recoverableCents, 0);
const byCheck = (outputs: AuditOutput[]) => {
  const totals: Record<string, number> = {};
  for (const o of outputs) for (const [check, cents] of Object.entries(o.totals.byCheckCents)) totals[check] = (totals[check] ?? 0) + cents!;
  return totals;
};
const nonDeadline = (outputs: AuditOutput[]) => outputs.flatMap((o) => o.findings).filter((f) => f.severity !== "deadline");
const deadlineOf = (outputs: AuditOutput[]) => outputs.flatMap((o) => o.findings).find((f) => f.check === "RENEWAL_NOTICE_DEADLINE");

// ---------------------------------------------------------------------------
// Golden tests
// ---------------------------------------------------------------------------

describe("audit — golden sample, before any rule", () => {
  const outputs = runSample();

  it("recovers $3,180.24 split across the five checks", () => {
    expect(recoverable(outputs)).toBe(expected.beforeRule.recoverableCents);
    expect(byCheck(outputs)).toEqual(expected.beforeRule.byCheckCents);
  });

  it("produces exactly the expected findings in order", () => {
    expect(nonDeadline(outputs).map(asExpected)).toEqual(expected.beforeRule.findings);
  });

  it("flags the renewal notice due 2 Dec 2026 with $15,068.16 at risk", () => {
    const deadline = deadlineOf(outputs)!;
    const want = expected.beforeRule.deadline;
    expect(deadline).toMatchObject({ severity: "deadline", deadline: want.noticeDeadline, atRiskCents: want.atRiskCents, amountCents: 0 });
    expect(deadline.math).toMatchObject({ termEnd: want.termEnd, noticeDays: want.noticeDays, noticeDeadline: want.noticeDeadline });
  });
});

describe("audit — golden sample, after 'seat cap 48 from April 2026'", () => {
  const outputs = runSample([seatCapRule]);
  const want = expected.afterRule_seatCap48FromApril2026;

  it("recovers $1,769.04", () => {
    expect(recoverable(outputs)).toBe(want.recoverableCents);
    expect(byCheck(outputs)).toEqual(want.byCheckCents);
  });

  it("widens the price check to all 48 seats and drops the seat findings", () => {
    expect(nonDeadline(outputs).map(asExpected)).toEqual(want.findings);
  });

  it("reports the seven seat findings as explained by the rule", () => {
    const explained = outputs.flatMap((o) => o.explained);
    expect(explained).toHaveLength(7);
    expect(explained.every((e) => e.check === "SEAT_CAP_EXCEEDED" && e.ruleIds.includes("rule_seats48"))).toBe(true);
  });

  it("keeps fingerprints stable so statuses survive a re-run", () => {
    const before = new Set(nonDeadline(runSample()).filter((f) => f.check === "PRICE_ABOVE_CONTRACT").map((f) => f.fingerprint));
    const after = nonDeadline(outputs).filter((f) => f.check === "PRICE_ABOVE_CONTRACT").map((f) => f.fingerprint);
    expect(after.every((fp) => before.has(fp))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Behaviour beyond the golden set
// ---------------------------------------------------------------------------

const cobalt = sample.vendors.find((v) => v.id === "v_cobalt")!;
const halcyon = sample.vendors.find((v) => v.id === "v_halcyon")!;

describe("audit — rules", () => {
  it("waives a check inside its period range only", () => {
    const waiveJuly: RuleInput = { id: "rule_dup", type: "waive_check", payload: { check: "DUPLICATE_BILLING", periodFrom: "2026-07-01", periodTo: "2026-07-31" } };
    const output = audit(toInput(cobalt, [waiveJuly]), sample.asOf);
    expect(output.findings.some((f) => f.check === "DUPLICATE_BILLING")).toBe(false);
    expect(output.explained).toEqual([expect.objectContaining({ check: "DUPLICATE_BILLING", ruleIds: ["rule_dup"], amountCents: 125568 })]);
    // The duplicate invoice is still kept out of the seat and price checks.
    expect(output.findings.filter((f) => f.periodLabel === "July 2026" && f.check === "PRICE_ABOVE_CONTRACT")).toHaveLength(1);
  });

  it("clears the price findings when the user accepts a 9% renewal increase", () => {
    const agreed: RuleInput = { id: "rule_9", type: "override_term", payload: { key: "renewal_uplift_cap_bps", value: 900, effectiveFrom: "2026-02-01" } };
    const output = audit(toInput(cobalt, [agreed]), sample.asOf);
    expect(output.findings.some((f) => f.check === "PRICE_ABOVE_CONTRACT")).toBe(false);
  });

  it("covers every billed seat with the price check when the seat check is waived", () => {
    const waiveSeats: RuleInput = { id: "rule_ws", type: "waive_check", payload: { check: "SEAT_CAP_EXCEEDED" } };
    const output = audit(toInput(cobalt, [waiveSeats]), sample.asOf);
    const april = output.findings.find((f) => f.check === "PRICE_ABOVE_CONTRACT" && f.periodLabel === "April 2026")!;
    expect(april.math.qty).toBe(48);
    expect(april.amountCents).toBe(4608);
  });
});

describe("audit — renewal deadline window", () => {
  it("stays quiet more than 45 days before the notice deadline", () => {
    const output = audit(toInput(cobalt), "2026-10-01");
    expect(output.findings.some((f) => f.check === "RENEWAL_NOTICE_DEADLINE")).toBe(false);
  });

  it("stays quiet once the notice deadline has passed", () => {
    const output = audit(toInput(cobalt), "2026-12-03");
    expect(output.findings.some((f) => f.check === "RENEWAL_NOTICE_DEADLINE")).toBe(false);
  });
});

describe("audit — findings carry their evidence", () => {
  it("links a price finding to its invoice line and the contract terms", () => {
    const output = audit(toInput(cobalt), sample.asOf);
    const feb = output.findings.find((f) => f.check === "PRICE_ABOVE_CONTRACT" && f.periodLabel === "February 2026")!;
    expect(feb.refs.invoiceIds).toEqual(["v_cobalt_INV-1034"]);
    expect(feb.refs.lineIds).toEqual(["v_cobalt_INV-1034_l0"]);
    expect(feb.refs.termIds).toEqual(expect.arrayContaining(["v_cobalt_t0", "v_cobalt_t2"]));
    expect(feb.math).toMatchObject({ result: "38.40" });
    expect(feb.explanation).toContain("$26.16");
    expect(feb.explanation).toContain("$25.20");
  });

  it("links a usage finding to the usage export total", () => {
    const output = audit(toInput(halcyon), sample.asOf);
    const usage = output.findings.find((f) => f.check === "USAGE_OVERBILLED")!;
    expect(usage.refs.usageTotalIds).toEqual(["v_halcyon_u0"]);
    expect(usage.meter).toBe("halcyon-large input");
  });

  it("is a pure function of its input", () => {
    expect(audit(toInput(cobalt), sample.asOf)).toEqual(audit(toInput(cobalt), sample.asOf));
  });
});

describe("audit — invoice shapes beyond the sample", () => {
  const withInvoices = (vendor: SeedVendor, invoices: SeedVendor["invoices"]): AuditInput =>
    toInput({ ...vendor, invoices });

  it("leaves tax and fee lines out of the seat and price checks", () => {
    const feb = cobalt.invoices.find((i) => i.invoiceNumber === "INV-1034")!;
    const taxed = {
      ...feb,
      totalCents: feb.totalCents + 8372,
      lines: [...feb.lines, { kind: "other" as const, description: "Sales tax 8%", quantity: 1, unitPriceMicros: 83_720_000, amountCents: 8372 }],
    };
    const output = audit(withInvoices(cobalt, [taxed]), sample.asOf);
    expect(nonDeadline([output]).map((f) => [f.check, f.amountCents])).toEqual([["PRICE_ABOVE_CONTRACT", 3840]]);
  });

  it("splits a meter billed both above usage and above rate without double counting", () => {
    const invoice = halcyon.invoices[0]!;
    const line = { description: "halcyon-large input tokens", meter: "halcyon-large input", quantity: 412_000_000, unitPriceMicros: 3_600_000, amountCents: 148320 };
    const output = audit(withInvoices(halcyon, [{ ...invoice, totalCents: 148320, lines: [line] }]), sample.asOf);
    const amounts = Object.fromEntries(output.findings.map((f) => [f.check, f.amountCents]));
    // Billed 412M at $3.60; fair is 389M at $3.00. Overcharge $1,483.20 − $1,167.00 = $316.20.
    expect(amounts).toEqual({ USAGE_OVERBILLED: 8280, RATE_ABOVE_CONTRACT: 23340 });
    expect(output.totals.recoverableCents).toBe(31620);
  });

  it("reports each extra copy of an invoice against the first one", () => {
    const july = cobalt.invoices.find((i) => i.invoiceNumber === "INV-1039")!;
    const copies = ["INV-2001", "INV-2002"].map((invoiceNumber, i) => ({ ...july, invoiceNumber, invoiceDate: `2026-07-0${i + 2}` }));
    const output = audit(withInvoices(cobalt, [july, ...copies]), sample.asOf);
    const duplicates = output.findings.filter((f) => f.check === "DUPLICATE_BILLING");
    expect(duplicates.map((f) => [f.invoiceNumber, f.math.duplicates])).toEqual([
      ["INV-2001", "INV-1039"],
      ["INV-2002", "INV-1039"],
    ]);
    expect(new Set(duplicates.map((f) => f.fingerprint)).size).toBe(2);
  });

  it("makes no price claim after a term that does not auto-renew", () => {
    const fixedTerm = { ...cobalt, terms: cobalt.terms.map((t) => (t.key === "auto_renew" ? { ...t, valueNum: 0 } : t)) };
    const output = audit(toInput(fixedTerm), sample.asOf);
    expect(output.findings.some((f) => f.check === "PRICE_ABOVE_CONTRACT")).toBe(false);
    expect(output.findings.some((f) => f.check === "RENEWAL_NOTICE_DEADLINE")).toBe(false);
  });
});
