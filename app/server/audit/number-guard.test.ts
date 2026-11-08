import { describe, expect, it } from "vitest";

import { checkAmounts, findMoneyTokens } from "./number-guard";

describe("findMoneyTokens", () => {
  it("finds dollar amounts in common formats", () => {
    const tokens = findMoneyTokens(
      "Billed $1,255.68 twice, USD 12 extra, 12.50 dollars more, 40 USD again, and US$3 on top.",
    );
    expect(tokens.map((t) => [t.text, t.cents])).toEqual([
      ["$1,255.68", 125568],
      ["USD 12", 1200],
      ["12.50 dollars", 1250],
      ["40 USD", 4000],
      ["US$3", 300],
    ]);
  });

  it("expands k and m suffixes", () => {
    expect(findMoneyTokens("about $5k").map((t) => t.cents)).toEqual([500000]);
    expect(findMoneyTokens("roughly $1.2m").map((t) => t.cents)).toEqual([120000000]);
  });

  it("ignores numbers that are not money", () => {
    expect(findMoneyTokens("48 seats on INV-1040 in 2026, a 5% cap, 60 days notice")).toEqual([]);
  });
});

describe("checkAmounts", () => {
  it("passes text whose amounts are all engine-computed", () => {
    const result = checkAmounts("We are owed $1,769.04 in total, including $1,255.68 for July.", [176904, 125568]);
    expect(result).toEqual({ ok: true, offending: [] });
  });

  it("flags an amount the engine did not compute", () => {
    const result = checkAmounts("Please refund $5,000 by Friday.", [176904]);
    expect(result.ok).toBe(false);
    expect(result.offending).toEqual([{ text: "$5,000", cents: 500000, index: 14 }]);
  });

  it("passes text with no amounts at all", () => {
    expect(checkAmounts("Please see the charges itemized below.", []).ok).toBe(true);
  });
});
