import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseUsageExport } from "./usage";

const SAMPLE_CSV = readFileSync(
  new URL("../../seed/sample-docs/halcyon-usage-export-2026-10.csv", import.meta.url),
  "utf8",
);

describe("parseUsageExport", () => {
  it("sums the sample export per model, direction and month", () => {
    const result = parseUsageExport(SAMPLE_CSV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byMeter = Object.fromEntries(result.totals.map((t) => [t.meter, t]));
    expect(byMeter["halcyon-large input"]).toEqual({
      meter: "halcyon-large input",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      quantity: 389_000_000,
    });
    expect(byMeter["halcyon-large output"].quantity).toBe(61_000_000);
    expect(byMeter["halcyon-small input"].quantity).toBe(900_000_000);
    expect(byMeter["halcyon-small output"].quantity).toBe(120_000_000);
    expect(result.totals).toHaveLength(4);
  });

  it("splits totals by calendar month", () => {
    const csv = [
      "date,model,input_tokens,output_tokens",
      "2026-09-30,m,10,1",
      "2026-10-01,m,20,2",
      "2026-10-31,m,30,3",
    ].join("\n");
    const result = parseUsageExport(csv);
    expect(result.ok && result.totals.filter((t) => t.meter === "m input")).toEqual([
      { meter: "m input", periodStart: "2026-09-01", periodEnd: "2026-09-30", quantity: 10 },
      { meter: "m input", periodStart: "2026-10-01", periodEnd: "2026-10-31", quantity: 50 },
    ]);
  });

  it("reads headers in any case and order, with quoted fields", () => {
    const csv = ['"Model","Date","Output_Tokens","Input_Tokens","note"', '"x","2026-10-02","5","7","a, b"'].join("\n");
    const result = parseUsageExport(csv);
    expect(result.ok && result.totals).toEqual([
      { meter: "x input", periodStart: "2026-10-01", periodEnd: "2026-10-31", quantity: 7 },
      { meter: "x output", periodStart: "2026-10-01", periodEnd: "2026-10-31", quantity: 5 },
    ]);
  });

  it("reports missing required columns", () => {
    const result = parseUsageExport("date,model,tokens\n2026-10-01,m,5");
    expect(result).toMatchObject({ ok: false, errorCode: "missing_columns" });
    if (!result.ok) expect(result.details.missing).toEqual(["input_tokens", "output_tokens"]);
  });

  it("reports the line numbers of rows with non-integer tokens", () => {
    const csv = ["date,model,input_tokens,output_tokens", "2026-10-01,m,5,1", "2026-10-02,m,5.5,1", "2026-10-03,m,abc,1"].join("\n");
    const result = parseUsageExport(csv);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_rows" });
    if (!result.ok) expect(result.details.lines).toEqual([3, 4]);
  });

  it("ignores blank lines", () => {
    const csv = "date,model,input_tokens,output_tokens\n2026-10-01,m,5,1\n\n";
    expect(parseUsageExport(csv).ok).toBe(true);
  });
});
