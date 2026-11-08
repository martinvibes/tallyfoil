/**
 * RENEWAL_NOTICE_DEADLINE: an auto-renewing contract whose notice deadline
 * (current term end − notice days) is within the next 45 days. Nothing is
 * recoverable yet; the next year's spend is at risk.
 */

import { addDays, daysBetween, formatLongDate, periodLabel } from "../dates";
import { Evidence, buildFinding } from "../findings";
import { formatCents, formatUsd, roundDiv } from "../money";
import { renewalAfter } from "../terms";
import type { Finding, InvoiceInput } from "../types";
import type { CheckContext } from "./context";

export const NOTICE_WINDOW_DAYS = 45;

const DAYS_PER_MONTH = 30.44;

/** Whole months an invoice covers: 1 for monthly, 3 for quarterly, 12 for annual. */
const monthsBilled = (invoice: InvoiceInput): number =>
  Math.max(1, Math.round((daysBetween(invoice.periodStart, invoice.periodEnd) + 1) / DAYS_PER_MONTH));

/** The latest bill scaled to a year: total × 12 ÷ months it covers. */
const annualCents = (invoice: InvoiceInput): number =>
  Number(roundDiv(BigInt(invoice.totalCents) * 12n, BigInt(monthsBilled(invoice))));

/** `invoices` in billing order, duplicates removed; the latest bill sets the amount at risk. */
export const renewalFinding = (ctx: CheckContext, invoices: readonly InvoiceInput[], asOf: string): Finding | null => {
  const { book } = ctx;
  const noticeDays = book.resolve("notice_days");
  if (!book.autoRenews() || noticeDays?.num == null) return null;

  const current = book.schedule(asOf)?.find((period) => asOf <= period.end);
  if (!current) return null;

  const deadline = addDays(current.end, -noticeDays.num);
  const daysLeft = daysBetween(asOf, deadline);
  if (daysLeft < 0 || daysLeft > NOTICE_WINDOW_DAYS) return null;

  const next = renewalAfter(current);
  const latest = invoices[invoices.length - 1];
  const atRiskCents = latest ? annualCents(latest) : 0;
  const cost = latest
    ? ` At the latest bill (${formatUsd(latest.totalCents)} for ${periodLabel(latest.periodStart, latest.periodEnd)}), ` +
      `the next term commits about ${formatUsd(atRiskCents)}.`
    : "";

  return buildFinding(ctx.vendor.id, {
    check: "RENEWAL_NOTICE_DEADLINE",
    title: `Renewal notice due ${formatLongDate(deadline)}`,
    explanation:
      `${ctx.vendor.name} renews automatically on ${formatLongDate(next.start)} unless you give ` +
      `${noticeDays.num} days' notice by ${formatLongDate(deadline)} (${daysLeft} days from today).${cost}`,
    amountCents: 0,
    atRiskCents,
    periodStart: next.start,
    periodEnd: next.end,
    deadline,
    math: {
      formula: "term end − notice days",
      termEnd: current.end,
      noticeDays: noticeDays.num,
      noticeDeadline: deadline,
      daysLeft,
      latestBill: latest ? formatCents(latest.totalCents) : "",
      monthsBilled: latest ? monthsBilled(latest) : 0,
      atRiskFormula: "latest bill × 12 ÷ months billed",
      atRisk: formatCents(atRiskCents),
      result: deadline,
    },
    evidence: new Evidence()
      .invoice(...(latest ? [latest.id] : []))
      .term(book.resolve("term_start"), book.resolve("term_end"), book.resolve("auto_renew"), noticeDays),
  });
};
