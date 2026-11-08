/**
 * Metered checks, per usage line:
 * - USAGE_OVERBILLED: billed quantity above what the usage export logged.
 *   The phantom units are claimed at the billed rate (what was paid for them).
 * - RATE_ABOVE_CONTRACT: billed rate above the contract rate, on the units
 *   that were really used. Together the two equal billed − fair, exactly.
 */

import { Evidence, buildFinding } from "../findings";
import { formatCents, formatCount, formatMicros, formatUsd, formatUsdMicros, tokenCostCents } from "../money";
import type { Finding, InvoiceInput, InvoiceLineInput, UsageTotalInput } from "../types";
import { type CheckContext, lineKind } from "./context";

type MeteredLine = InvoiceLineInput & { meter: string };

interface LoggedUsage {
  quantity: number;
  ids: string[];
}

/** Usage logged for `meter` inside the invoice period, or null if the export has none. */
const loggedUsage = (totals: readonly UsageTotalInput[], meter: string, invoice: InvoiceInput): LoggedUsage | null => {
  const matching = totals.filter(
    (total) => total.meter === meter && invoice.periodStart <= total.periodStart && total.periodEnd <= invoice.periodEnd,
  );
  if (matching.length === 0) return null;
  return { quantity: matching.reduce((sum, total) => sum + total.quantity, 0), ids: matching.map((total) => total.id) };
};

const usageFinding = (ctx: CheckContext, invoice: InvoiceInput, line: MeteredLine, logged: LoggedUsage): Finding | null => {
  const extra = line.quantity - logged.quantity;
  if (extra <= 0) return null;
  const amountCents = tokenCostCents(extra, line.unitPriceMicros);
  if (amountCents <= 0) return null;

  return buildFinding(ctx.vendor.id, {
    check: "USAGE_OVERBILLED",
    title: "Billed for usage that never happened",
    explanation:
      `Billed ${formatCount(line.quantity)} ${line.meter} tokens; your usage export logs ${formatCount(logged.quantity)}. ` +
      `The ${formatCount(extra)} extra tokens at ${formatUsdMicros(line.unitPriceMicros)} per 1M cost ${formatUsd(amountCents)}.`,
    amountCents,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    invoiceNumber: invoice.invoiceNumber,
    meter: line.meter,
    math: {
      formula: "(billed − logged) × billed rate ÷ 1M",
      meter: line.meter,
      billed: line.quantity,
      logged: logged.quantity,
      rate: formatMicros(line.unitPriceMicros),
      result: formatCents(amountCents),
    },
    evidence: new Evidence().invoice(invoice.id).line(line.id).usage(...logged.ids),
  });
};

const rateFinding = (
  ctx: CheckContext,
  invoice: InvoiceInput,
  line: MeteredLine,
  logged: LoggedUsage | null,
): Finding | null => {
  const contract = ctx.book.resolve("meter_rate", { date: invoice.periodStart, meter: line.meter });
  if (contract?.num == null || line.unitPriceMicros <= contract.num) return null;

  const qty = logged ? Math.min(line.quantity, logged.quantity) : line.quantity;
  const amountCents = tokenCostCents(qty, line.unitPriceMicros - contract.num);
  if (amountCents <= 0) return null;

  return buildFinding(ctx.vendor.id, {
    check: "RATE_ABOVE_CONTRACT",
    title: "Rate above contract",
    explanation:
      `Billed ${formatUsdMicros(line.unitPriceMicros)} per 1M ${line.meter} tokens; the contract rate is ` +
      `${formatUsdMicros(contract.num)}. On ${formatCount(qty)} tokens that is ${formatUsd(amountCents)} extra.`,
    amountCents,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    invoiceNumber: invoice.invoiceNumber,
    meter: line.meter,
    math: {
      formula: "(billed rate − contract rate) × tokens ÷ 1M",
      meter: line.meter,
      billedRate: formatMicros(line.unitPriceMicros),
      contractRate: formatMicros(contract.num),
      qty,
      result: formatCents(amountCents),
    },
    evidence: new Evidence()
      .invoice(invoice.id)
      .line(line.id)
      .term(contract)
      .usage(...(logged?.ids ?? [])),
  });
};

export const meteredFindings = (
  ctx: CheckContext,
  invoice: InvoiceInput,
  usageTotals: readonly UsageTotalInput[],
): Finding[] =>
  invoice.lines
    .filter((line): line is MeteredLine => lineKind(line) === "usage" && !!line.meter && line.quantity > 0)
    .flatMap((line) => {
      const logged = loggedUsage(usageTotals, line.meter, invoice);
      return [logged && usageFinding(ctx, invoice, line, logged), rateFinding(ctx, invoice, line, logged)];
    })
    .filter((finding): finding is Finding => !!finding);
