import { describe, expect, it } from "vitest";

import type { ExplainedFinding, Finding } from "../audit/types";
import { type StoredFinding, reconcileFindings } from "./reconcile";

const finding = (fingerprint: string): Finding => ({
  fingerprint,
  vendorId: "ven_1",
  check: "SEAT_CAP_EXCEEDED",
  severity: "verify",
  title: "t",
  explanation: "e",
  amountCents: 100,
  atRiskCents: 0,
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
  periodLabel: "April 2026",
  invoiceNumber: null,
  meter: null,
  deadline: null,
  math: { formula: "f", result: "r" },
  refs: { invoiceIds: [], lineIds: [], termIds: [], usageTotalIds: [], ruleIds: [] },
});

const stored = (fingerprint: string, status: StoredFinding["status"]): StoredFinding => ({ id: `fnd_${fingerprint}`, fingerprint, status });

const explained = (fingerprint: string, ruleIds: string[]): ExplainedFinding => ({
  fingerprint,
  check: "SEAT_CAP_EXCEEDED",
  periodLabel: "April 2026",
  amountCents: 100,
  ruleIds,
});

describe("reconcileFindings", () => {
  it("inserts findings it has never seen as open", () => {
    const plan = reconcileFindings([], { findings: [finding("a")], explained: [] });
    expect(plan.insert.map((f) => f.fingerprint)).toEqual(["a"]);
    expect(plan.opened).toBe(1);
  });

  it("keeps the user's accept and reject decisions on re-runs", () => {
    const plan = reconcileFindings([stored("a", "accepted"), stored("b", "rejected"), stored("c", "open")], {
      findings: [finding("a"), finding("b"), finding("c")],
      explained: [],
    });
    expect(plan.update.map((u) => [u.id, u.status])).toEqual([
      ["fnd_a", "accepted"],
      ["fnd_b", "rejected"],
      ["fnd_c", "open"],
    ]);
    expect(plan.opened).toBe(0);
  });

  it("reopens a finding that comes back after it was explained or cleared", () => {
    const plan = reconcileFindings([stored("a", "explained"), stored("b", "cleared")], {
      findings: [finding("a"), finding("b")],
      explained: [],
    });
    expect(plan.update.map((u) => u.status)).toEqual(["open", "open"]);
    expect(plan.opened).toBe(2);
  });

  it("marks vanished findings explained by the rules that removed them, or cleared", () => {
    const plan = reconcileFindings([stored("a", "rejected"), stored("b", "open"), stored("c", "cleared")], {
      findings: [],
      explained: [explained("a", ["rul_1"])],
    });
    expect(plan.retire).toEqual([
      { id: "fnd_a", status: "explained", ruleIds: ["rul_1"] },
      { id: "fnd_b", status: "cleared", ruleIds: null },
      { id: "fnd_c", status: "cleared", ruleIds: null },
    ]);
    expect(plan.resolved).toBe(2);
  });
});
