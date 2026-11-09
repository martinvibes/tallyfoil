import { describe, expect, it } from "vitest";

import { readCredit } from "./reply.js";

const DISPUTED = 160_128; // $1,601.28

describe("readCredit", () => {
  it("records a full credit when the vendor's line states the disputed total", () => {
    expect(readCredit("credited", ["We have issued credit memo CM-2291 for $1,601.28."], DISPUTED)).toEqual({
      ok: true,
      status: "credited",
      recoveredCents: DISPUTED,
    });
  });

  it("records a partial credit for a smaller amount", () => {
    expect(readCredit("credited", ["A credit of USD 1,255.68 will appear on your next invoice."], DISPUTED)).toEqual({
      ok: true,
      status: "partially_credited",
      recoveredCents: 125_568,
    });
  });

  it("takes the largest amount not above the dispute when the line names several", () => {
    const result = readCredit("credited", ["Of the $3,066.24 you raised we accept $1,601.28."], DISPUTED);
    expect(result).toMatchObject({ ok: true, recoveredCents: DISPUTED });
  });

  it("rejects a credit quote with no amount, so the agent quotes the right line", () => {
    expect(readCredit("credited", ["We agree and will fix it."], DISPUTED)).toMatchObject({ ok: false, errorCode: "value_not_in_quote" });
  });

  it("rejects a credit larger than what was disputed", () => {
    expect(readCredit("credited", ["We credited $5,000.00."], DISPUTED)).toMatchObject({ ok: false, errorCode: "credit_exceeds_dispute" });
  });

  it("records a refusal as nothing recovered", () => {
    expect(readCredit("refused", ["We believe the invoices are correct."], DISPUTED)).toEqual({
      ok: true,
      status: "refused",
      recoveredCents: 0,
    });
  });
});
