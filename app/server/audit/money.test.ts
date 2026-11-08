import { describe, expect, it } from "vitest";

import {
  centsFromMicros,
  decimalToMicros,
  formatMicros,
  formatUsd,
  parseUsd,
  tokenCostCents,
  usdToMicros,
} from "./money";

describe("decimalToMicros", () => {
  it("parses plain, grouped and fractional decimals exactly", () => {
    expect(decimalToMicros("1,255.68")).toBe(1_255_680_000n);
    expect(decimalToMicros("0.25")).toBe(250_000n);
    expect(decimalToMicros("412")).toBe(412_000_000n);
  });

  it("rounds beyond six decimals half up", () => {
    expect(decimalToMicros("0.0000005")).toBe(1n);
    expect(decimalToMicros("0.0000004")).toBe(0n);
  });

  it("rejects text that is not a decimal", () => {
    expect(() => decimalToMicros("twelve")).toThrow();
    expect(() => decimalToMicros("1.2.3")).toThrow();
  });
});

describe("parseUsd", () => {
  it("strips currency markers and thousands separators", () => {
    expect(parseUsd("USD 1,255.68")).toBe(125568);
    expect(parseUsd("$960")).toBe(96000);
    expect(parseUsd("US$ 0.5")).toBe(50);
    expect(parseUsd("1255.68")).toBe(125568);
  });

  it("rounds sub-cent amounts half up", () => {
    expect(parseUsd("12.345")).toBe(1235);
    expect(parseUsd("12.344")).toBe(1234);
  });

  it("reads a leading minus as a negative amount", () => {
    expect(parseUsd("-$38.40")).toBe(-3840);
  });

  it("throws on input with no amount", () => {
    expect(() => parseUsd("USD")).toThrow();
  });
});

describe("usdToMicros", () => {
  it("converts unit prices to integer micro-dollars", () => {
    expect(usdToMicros("26.16")).toBe(26_160_000);
    expect(usdToMicros("USD 0.25")).toBe(250_000);
    expect(usdToMicros("3")).toBe(3_000_000);
  });
});

describe("centsFromMicros", () => {
  it("rounds half a cent up", () => {
    expect(centsFromMicros(26_160_000)).toBe(2616);
    expect(centsFromMicros(5_000n)).toBe(1);
    expect(centsFromMicros(4_999)).toBe(0);
  });

  it("rounds negative half cents away from zero", () => {
    expect(centsFromMicros(-5_000)).toBe(-1);
  });
});

describe("tokenCostCents", () => {
  it("prices token counts at a per-million rate without floats", () => {
    expect(tokenCostCents(23_000_000, 3_000_000)).toBe(6900);
    expect(tokenCostCents(900_000_000, 50_000)).toBe(4500);
  });
});

describe("formatUsd", () => {
  it("formats cents with grouping and two decimals", () => {
    expect(formatUsd(125568)).toBe("$1,255.68");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(150_681_600)).toBe("$1,506,816.00");
  });

  it("puts the minus sign before the dollar sign", () => {
    expect(formatUsd(-3840)).toBe("-$38.40");
  });
});

describe("formatMicros", () => {
  it("shows at least two decimals and trims extra trailing zeros", () => {
    expect(formatMicros(26_160_000)).toBe("26.16");
    expect(formatMicros(250_000)).toBe("0.25");
    expect(formatMicros(3_000_000)).toBe("3.00");
    expect(formatMicros(3_500)).toBe("0.0035");
  });
});
