import { describe, expect, it } from "vitest";

import { parseTermValue } from "./term-values";

const ok = (key: Parameters<typeof parseTermValue>[0], raw: Parameters<typeof parseTermValue>[1]) => {
  const result = parseTermValue(key, raw);
  if (!result.ok) throw new Error(result.message);
  return result.value;
};

describe("parseTermValue", () => {
  it("converts prices and rates to micro-dollars", () => {
    expect(ok("seat_price", "USD 24.00")).toMatchObject({ valueNum: 24_000_000, claim: { kind: "decimal", micros: 24_000_000 } });
    expect(ok("meter_rate", "0.25")).toMatchObject({ valueNum: 250_000 });
    expect(ok("seat_price", 26.16)).toMatchObject({ valueNum: 26_160_000 });
  });

  it("reads percentages as basis points", () => {
    expect(ok("renewal_uplift_cap_bps", "5%")).toMatchObject({ valueNum: 500, claim: { kind: "percent", bps: 500 } });
    expect(ok("renewal_uplift_cap_bps", "2.5 percent")).toMatchObject({ valueNum: 250 });
    expect(ok("renewal_uplift_cap_bps", 5)).toMatchObject({ valueNum: 500 });
    expect(ok("renewal_uplift_cap_bps", 500)).toMatchObject({ valueNum: 500 });
  });

  it("reads counts as whole numbers", () => {
    expect(ok("seat_cap", "40")).toMatchObject({ valueNum: 40, claim: { kind: "integer", value: 40 } });
    expect(ok("notice_days", 60)).toMatchObject({ valueNum: 60 });
    expect(parseTermValue("seat_cap", "40.5")).toMatchObject({ ok: false });
  });

  it("reads dates written in words or ISO", () => {
    expect(ok("term_end", "January 31, 2026")).toMatchObject({ valueDate: "2026-01-31", claim: { kind: "date", iso: "2026-01-31" } });
    expect(ok("term_start", "2025-02-01")).toMatchObject({ valueDate: "2025-02-01" });
    expect(parseTermValue("term_end", "soon")).toMatchObject({ ok: false });
  });

  it("reads yes/no flags and free text", () => {
    expect(ok("auto_renew", "yes")).toMatchObject({ valueNum: 1, claim: { kind: "presence" } });
    expect(ok("auto_renew", false)).toMatchObject({ valueNum: 0 });
    expect(ok("billing_basis", "usage_export")).toMatchObject({ valueText: "usage_export" });
    expect(parseTermValue("auto_renew", "maybe")).toMatchObject({ ok: false });
  });
});
