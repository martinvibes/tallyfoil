/**
 * The audit engine: a pure function from (contract, rules, invoices, usage)
 * to findings with exact amounts. The AI never computes money; this does.
 *
 * Order matters and prevents double counting:
 * 1. Duplicate invoices are found first and kept out of every other check.
 * 2. Per invoice: seats over the cap, then price on the seats within the cap;
 *    usage over the export, then rate on the usage that really happened.
 * 3. The renewal notice deadline, which puts money at risk rather than owed.
 * Waived checks are dropped last. Findings that only exist without the
 * user's rules are reported as "explained", citing the rules responsible.
 */

import { type CheckContext } from "./checks/context";
import { duplicateFinding, findDuplicates } from "./checks/duplicates";
import { meteredFindings } from "./checks/metered";
import { renewalFinding } from "./checks/renewal";
import { seatFindings } from "./checks/seats";
import { Waivers, rulesExplaining } from "./rules";
import { TermBook } from "./terms";
import type { AuditInput, AuditOutput, AuditTotals, ExplainedFinding, Finding, InvoiceInput, RuleInput } from "./types";

export const ENGINE_VERSION = "1.0.0";

const byBillingOrder = (a: InvoiceInput, b: InvoiceInput) =>
  a.invoiceDate.localeCompare(b.invoiceDate) || a.invoiceNumber.localeCompare(b.invoiceNumber);

const runChecks = (input: AuditInput, rules: readonly RuleInput[], asOf: string): Finding[] => {
  const ctx: CheckContext = { vendor: input.vendor, book: new TermBook(input.terms, rules), waivers: new Waivers(rules) };
  const invoices = [...input.invoices].sort(byBillingOrder);
  const duplicates = findDuplicates(invoices);

  const invoiceFindings = invoices.flatMap((invoice) => {
    const original = duplicates.get(invoice.id);
    if (original) return [duplicateFinding(ctx, invoice, original)];
    return [...seatFindings(ctx, invoice), ...meteredFindings(ctx, invoice, input.usageTotals)];
  });
  const deadline = renewalFinding(
    ctx,
    invoices.filter((invoice) => !duplicates.has(invoice.id)),
    asOf,
  );

  return [...invoiceFindings, ...(deadline ? [deadline] : [])].filter((finding) => !ctx.waivers.covers(finding));
};

const explain = (input: AuditInput, findings: readonly Finding[], asOf: string): ExplainedFinding[] => {
  if (input.rules.length === 0) return [];
  const remaining = new Set(findings.map((finding) => finding.fingerprint));
  return runChecks(input, [], asOf)
    .filter((finding) => !remaining.has(finding.fingerprint))
    .map((finding) => ({
      fingerprint: finding.fingerprint,
      check: finding.check,
      periodLabel: finding.periodLabel,
      amountCents: finding.amountCents,
      ruleIds: rulesExplaining(finding, input.rules),
    }));
};

const totalsOf = (findings: readonly Finding[]): AuditTotals => {
  const owed = findings.filter((finding) => finding.severity !== "deadline");
  const byCheckCents: AuditTotals["byCheckCents"] = {};
  for (const finding of owed) byCheckCents[finding.check] = (byCheckCents[finding.check] ?? 0) + finding.amountCents;

  return {
    recoverableCents: owed.reduce((sum, finding) => sum + finding.amountCents, 0),
    atRiskCents: findings.reduce((sum, finding) => sum + finding.atRiskCents, 0),
    findingCount: owed.length,
    byCheckCents,
  };
};

export const audit = (input: AuditInput, asOf: string): AuditOutput => {
  const findings = runChecks(input, input.rules, asOf);
  return {
    engineVersion: ENGINE_VERSION,
    findings,
    explained: explain(input, findings, asOf),
    totals: totalsOf(findings),
  };
};
