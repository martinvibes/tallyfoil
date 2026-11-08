/**
 * How user rules act on findings: `waive_check` suppresses a check for a
 * range of periods; `override_term` changes the contract the checks read
 * (see terms.ts). Both are cited when a finding disappears because of them.
 */

import type { CheckCode, Finding, RuleInput, TermKey, WaiveCheckRule } from "./types";

/** Terms whose value can change whether a check fires. */
const TERMS_READ_BY: Record<CheckCode, readonly TermKey[]> = {
  DUPLICATE_BILLING: [],
  SEAT_CAP_EXCEEDED: ["seat_cap"],
  PRICE_ABOVE_CONTRACT: ["seat_price", "renewal_uplift_cap_bps", "term_start", "term_end", "auto_renew", "seat_cap"],
  USAGE_OVERBILLED: [],
  RATE_ABOVE_CONTRACT: ["meter_rate"],
  RENEWAL_NOTICE_DEADLINE: ["term_start", "term_end", "auto_renew", "notice_days"],
};

type Scope = Pick<Finding, "check" | "periodStart" | "meter">;

const waives = (rule: WaiveCheckRule, { check, periodStart, meter }: Scope) => {
  const { payload } = rule;
  return (
    payload.check === check &&
    (!payload.periodFrom || payload.periodFrom <= periodStart) &&
    (!payload.periodTo || periodStart <= payload.periodTo) &&
    (!payload.meter || payload.meter === meter)
  );
};

export class Waivers {
  private readonly rules: WaiveCheckRule[];

  constructor(rules: readonly RuleInput[]) {
    this.rules = rules.filter((rule): rule is WaiveCheckRule => rule.type === "waive_check");
  }

  /** True when a waiver covers this check for the period starting `periodStart`. */
  covers(scope: Scope): boolean {
    return this.rules.some((rule) => waives(rule, scope));
  }
}

const touches = (rule: RuleInput, finding: Finding): boolean => {
  if (rule.type === "waive_check") return waives(rule, finding);
  const { key, meter, effectiveFrom, effectiveTo } = rule.payload;
  return (
    TERMS_READ_BY[finding.check].includes(key) &&
    (!meter || meter === finding.meter) &&
    (!effectiveFrom || effectiveFrom <= finding.periodEnd) &&
    (!effectiveTo || finding.periodStart <= effectiveTo)
  );
};

/**
 * The rules that explain why `finding` no longer fires. Every rule is cited
 * when none matches directly: the finding only disappears when rules apply.
 */
export const rulesExplaining = (finding: Finding, rules: readonly RuleInput[]): string[] => {
  const direct = rules.filter((rule) => touches(rule, finding));
  return (direct.length > 0 ? direct : rules).map((rule) => rule.id);
};
