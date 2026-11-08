/**
 * The effective contract: extracted terms with the user's rules applied on
 * top. Every lookup returns the record it came from, so findings can cite
 * the exact term (or rule) behind each number.
 */

import { addDays, addMonths } from "./dates";
import type { RuleInput, TermInput, TermKey, TermSource } from "./types";

export interface ResolvedTerm {
  /** Term id, or the rule id when a rule supplied the value. */
  id: string;
  fromRule: boolean;
  num: number | null;
  text: string | null;
  date: string | null;
  effectiveFrom: string | null;
}

export interface ContractPeriod {
  /** 0 for the initial term, then one per renewal. */
  index: number;
  start: string;
  end: string;
}

const DATE_KEYS: ReadonlySet<TermKey> = new Set(["term_start", "term_end"]);
const TEXT_KEYS: ReadonlySet<TermKey> = new Set(["billing_basis"]);
const SOURCE_PRIORITY: Record<TermSource, number> = { agent: 0, user: 1, rule: 2 };
const RENEWAL_MONTHS = 12;
const MAX_RENEWALS = 100;

/** Turns `override_term` rules into terms that outrank anything extracted. */
export const applyRules = (terms: readonly TermInput[], rules: readonly RuleInput[]): TermInput[] => [
  ...terms,
  ...rules.flatMap((rule): TermInput[] => {
    if (rule.type !== "override_term") return [];
    const { key, value, meter, effectiveFrom, effectiveTo } = rule.payload;
    return [
      {
        id: rule.id,
        key,
        meter: meter ?? null,
        valueNum: typeof value === "number" ? value : null,
        valueText: TEXT_KEYS.has(key) ? String(value) : null,
        valueDate: DATE_KEYS.has(key) ? String(value) : null,
        effectiveFrom: effectiveFrom ?? null,
        effectiveTo: effectiveTo ?? null,
        source: "rule",
      },
    ];
  }),
];

/** The 12-month term that starts the day after `period` ends. */
export const renewalAfter = (period: ContractPeriod): ContractPeriod => {
  const start = addDays(period.end, 1);
  return { index: period.index + 1, start, end: addDays(addMonths(start, RENEWAL_MONTHS), -1) };
};

const inRange = (term: TermInput, date: string | undefined) =>
  date === undefined || ((!term.effectiveFrom || term.effectiveFrom <= date) && (!term.effectiveTo || date <= term.effectiveTo));

export class TermBook {
  private readonly terms: TermInput[];

  constructor(terms: readonly TermInput[], rules: readonly RuleInput[]) {
    this.terms = applyRules(terms, rules);
  }

  /**
   * The term in force for `key` (and `meter`) on `date`. Rules beat user
   * edits, which beat extracted terms; then the most recently effective wins.
   */
  resolve(key: TermKey, { date, meter }: { date?: string; meter?: string | null } = {}): ResolvedTerm | null {
    let best: { term: TermInput; rank: Rank } | null = null;

    for (const [index, term] of this.terms.entries()) {
      if (term.key !== key || (term.meter ?? null) !== (meter ?? null) || !inRange(term, date)) continue;
      const rank: Rank = [SOURCE_PRIORITY[term.source ?? "agent"], term.effectiveFrom ?? "", index];
      if (!best || compareRank(rank, best.rank) > 0) best = { term, rank };
    }

    if (!best) return null;
    const { term } = best;
    return {
      id: term.id,
      fromRule: term.source === "rule",
      num: term.valueNum ?? null,
      text: term.valueText ?? null,
      date: term.valueDate ?? null,
      effectiveFrom: term.effectiveFrom ?? null,
    };
  }

  /**
   * The initial term and its 12-month renewals, through the period covering
   * `until`. Null when the contract dates are unknown. When the contract does
   * not auto-renew, the schedule stops at the initial term.
   */
  schedule(until: string): ContractPeriod[] | null {
    const start = this.resolve("term_start")?.date;
    const end = this.resolve("term_end")?.date;
    if (!start || !end) return null;

    let last: ContractPeriod = { index: 0, start, end };
    const periods = [last];
    const renews = this.autoRenews();
    while (renews && last.end < until && periods.length <= MAX_RENEWALS) {
      last = renewalAfter(last);
      periods.push(last);
    }
    return periods;
  }

  autoRenews(): boolean {
    return this.resolve("auto_renew")?.num === 1;
  }
}

/** [source priority, effectiveFrom, position]; higher wins. */
type Rank = [number, string, number];

const compareRank = (a: Rank, b: Rank) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2];
