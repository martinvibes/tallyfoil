import { describe, expect, it } from "vitest";

import { type LedgerRow, ledgerTotals } from "./ledger";

const row = (overrides: Partial<LedgerRow>): LedgerRow => ({
  check: "PRICE_ABOVE_CONTRACT",
  status: "open",
  amountCents: 100,
  atRiskCents: 0,
  ...overrides,
});

describe("ledgerTotals", () => {
  it("counts open and accepted findings as recoverable", () => {
    const totals = ledgerTotals([row({ amountCents: 3840 }), row({ status: "accepted", amountCents: 1000 })]);
    expect(totals).toMatchObject({ recoverableCents: 4840, findingCount: 2, acceptedCount: 1 });
  });

  it("leaves rejected, explained and cleared findings out of the money", () => {
    const totals = ledgerTotals([
      row({ status: "rejected", amountCents: 50 }),
      row({ status: "explained", amountCents: 70 }),
      row({ status: "cleared", amountCents: 90 }),
      row({ amountCents: 10 }),
    ]);
    expect(totals).toMatchObject({ recoverableCents: 10, findingCount: 1, rejectedCount: 1, explainedCount: 1 });
  });

  it("puts renewal deadlines in at risk, never in recoverable or the finding count", () => {
    const totals = ledgerTotals([
      row({ check: "RENEWAL_NOTICE_DEADLINE", amountCents: 0, atRiskCents: 1506816 }),
      row({ check: "RENEWAL_NOTICE_DEADLINE", status: "rejected", atRiskCents: 999 }),
      row({ amountCents: 318024 }),
    ]);
    expect(totals).toMatchObject({ recoverableCents: 318024, atRiskCents: 1506816, findingCount: 1, deadlineCount: 1 });
  });
});
