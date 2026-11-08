/**
 * Seat checks, per invoice:
 * - SEAT_CAP_EXCEEDED: more seats billed than the contract allows. Severity
 *   "verify", because the customer may have approved them.
 * - PRICE_ABOVE_CONTRACT: unit price above the allowed price, counted on the
 *   seats within the cap only (seats over the cap are already claimed in full).
 */

import { formatLongDate } from "../dates";
import { Evidence, buildFinding } from "../findings";
import { centsFromMicros, formatCents, formatCount, formatMicros, formatUsd, formatUsdMicros, roundDiv } from "../money";
import type { ResolvedTerm, TermBook } from "../terms";
import type { Finding, InvoiceInput, InvoiceLineInput } from "../types";
import { type CheckContext, lineKind } from "./context";

interface SeatAllocation {
  line: InvoiceLineInput;
  withinCap: number;
  overCap: number;
}

type AllowedPrice =
  | { basis: "contract"; micros: number; terms: ResolvedTerm[] }
  | { basis: "agreed"; micros: number; since: string; terms: ResolvedTerm[] }
  | { basis: "renewal"; micros: number; priorMicros: number; capBps: number; terms: ResolvedTerm[] };

const BPS_PER_UNIT = 10_000n;

/** The first `cap` seats, in line order, are within the cap. */
const allocate = (lines: readonly InvoiceLineInput[], cap: number | null): SeatAllocation[] => {
  let remaining = cap ?? Number.POSITIVE_INFINITY;
  return lines.map((line) => {
    const withinCap = Math.min(line.quantity, remaining);
    remaining -= withinCap;
    return { line, withinCap, overCap: line.quantity - withinCap };
  });
};

/**
 * The most the vendor may charge per seat on `date`: the contract price,
 * raised by the uplift cap at each renewal, or a price agreed later (a dated
 * term or rule). Null when no price can be proven: no price on record, the
 * contract was not in force, or renewals happened with no cap on increases.
 */
export const allowedSeatPrice = (book: TermBook, date: string): AllowedPrice | null => {
  const schedule = book.schedule(date);
  if (schedule && !schedule.some((period) => period.start <= date && date <= period.end)) return null;

  const price = book.resolve("seat_price", { date });
  if (price?.num == null) return null;

  const initialStart = schedule?.[0]?.start;
  const agreedFrom = price.effectiveFrom && (!initialStart || price.effectiveFrom > initialStart) ? price.effectiveFrom : null;
  const renewals = (schedule ?? []).filter(
    (period) => period.index > 0 && period.start <= date && (!agreedFrom || period.start > agreedFrom),
  );

  if (renewals.length === 0) {
    return agreedFrom
      ? { basis: "agreed", micros: price.num, since: agreedFrom, terms: [price] }
      : { basis: "contract", micros: price.num, terms: [price] };
  }

  const terms: ResolvedTerm[] = [price];
  let micros = BigInt(price.num);
  let priorMicros = micros;
  let capBps = 0;
  for (const renewal of renewals) {
    const cap = book.resolve("renewal_uplift_cap_bps", { date: renewal.start });
    if (cap?.num == null) return null;
    terms.push(cap);
    priorMicros = micros;
    capBps = cap.num;
    micros = roundDiv(micros * (BPS_PER_UNIT + BigInt(cap.num)), BPS_PER_UNIT);
  }
  terms.push(...[book.resolve("term_start"), book.resolve("term_end"), book.resolve("auto_renew")].filter((t) => t !== null));
  return { basis: "renewal", micros: Number(micros), priorMicros: Number(priorMicros), capBps, terms };
};

const formatBps = (bps: number) => `${bps / 100}%`;

const distinctUnits = (allocations: readonly SeatAllocation[]) =>
  [...new Set(allocations.map((a) => a.line.unitPriceMicros))];

const describeAllowed = (allowed: AllowedPrice, vendorName: string): string => {
  const limit = formatUsdMicros(allowed.micros);
  switch (allowed.basis) {
    case "contract":
      return `the contract price is ${limit}/seat`;
    case "agreed":
      return `the price agreed from ${formatLongDate(allowed.since)} is ${limit}/seat`;
    case "renewal":
      return (
        `the contract caps renewal increases at ${formatBps(allowed.capBps)} over ` +
        `${formatUsdMicros(allowed.priorMicros)}, so the most ${vendorName} can charge is ${limit}`
      );
  }
};

const seatCapFinding = (
  ctx: CheckContext,
  invoice: InvoiceInput,
  allocations: readonly SeatAllocation[],
  cap: ResolvedTerm & { num: number },
): Finding | null => {
  const over = allocations.filter((a) => a.overCap > 0);
  const extraSeats = over.reduce((sum, a) => sum + a.overCap, 0);
  if (extraSeats === 0) return null;

  const billedSeats = allocations.reduce((sum, a) => sum + a.line.quantity, 0);
  const amountCents = centsFromMicros(over.reduce((sum, a) => sum + BigInt(a.overCap) * BigInt(a.line.unitPriceMicros), 0n));

  return buildFinding(ctx.vendor.id, {
    check: "SEAT_CAP_EXCEEDED",
    title: "Seats above the contract cap",
    explanation:
      `Billed ${formatCount(billedSeats)} seats; the contract caps seats at ${formatCount(cap.num)}. ` +
      `The ${formatCount(extraSeats)} extra seats cost ${formatUsd(amountCents)}. ` +
      `Check whether anyone approved more seats before disputing.`,
    amountCents,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    invoiceNumber: invoice.invoiceNumber,
    math: {
      formula: "(billed seats − cap) × billed unit",
      billedSeats,
      cap: cap.num,
      extraSeats,
      billedUnit: distinctUnits(over).map(formatMicros).join(" / "),
      result: formatCents(amountCents),
    },
    evidence: new Evidence().invoice(invoice.id).line(...over.map((a) => a.line.id)).term(cap),
  });
};

const priceFinding = (
  ctx: CheckContext,
  invoice: InvoiceInput,
  allocations: readonly SeatAllocation[],
  cap: ResolvedTerm | null,
): Finding | null => {
  const allowed = allowedSeatPrice(ctx.book, invoice.periodStart);
  if (!allowed) return null;

  const overpriced = allocations.filter((a) => a.withinCap > 0 && a.line.unitPriceMicros > allowed.micros);
  if (overpriced.length === 0) return null;

  const qty = overpriced.reduce((sum, a) => sum + a.withinCap, 0);
  const overchargeMicros = overpriced.reduce(
    (sum, a) => sum + BigInt(a.withinCap) * BigInt(a.line.unitPriceMicros - allowed.micros),
    0n,
  );
  const amountCents = centsFromMicros(overchargeMicros);
  if (amountCents <= 0) return null;

  const units = distinctUnits(overpriced);
  const [onlyUnit] = units.length === 1 ? units : [];
  const billed = units.map(formatUsdMicros).join(" / ");
  const seats = cap ? "seats within the cap" : "seats";
  const breakdown =
    onlyUnit === undefined
      ? `${formatUsd(amountCents)} in total`
      : `${formatCount(qty)} × ${formatUsdMicros(onlyUnit - allowed.micros)} = ${formatUsd(amountCents)}`;

  return buildFinding(ctx.vendor.id, {
    check: "PRICE_ABOVE_CONTRACT",
    title: "Seat price above contract",
    explanation: `Billed ${billed}/seat; ${describeAllowed(allowed, ctx.vendor.name)}. On the ${formatCount(qty)} ${seats}, that is ${breakdown}.`,
    amountCents,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    invoiceNumber: invoice.invoiceNumber,
    math: {
      formula: "(billed unit − allowed unit) × seats",
      billedUnit: units.map(formatMicros).join(" / "),
      allowedUnit: formatMicros(allowed.micros),
      qty,
      result: formatCents(amountCents),
    },
    evidence: new Evidence()
      .invoice(invoice.id)
      .line(...overpriced.map((a) => a.line.id))
      .term(...allowed.terms, cap),
  });
};

export const seatFindings = (ctx: CheckContext, invoice: InvoiceInput): Finding[] => {
  const lines = invoice.lines.filter((line) => lineKind(line) === "seats" && line.quantity > 0);
  if (lines.length === 0) return [];

  const capTerm = ctx.book.resolve("seat_cap", { date: invoice.periodStart });
  const capWaived = ctx.waivers.covers({ check: "SEAT_CAP_EXCEEDED", periodStart: invoice.periodStart, meter: null });
  const cap = capTerm?.num != null && !capWaived ? { ...capTerm, num: capTerm.num } : null;

  const allocations = allocate(lines, cap?.num ?? null);
  return [cap && seatCapFinding(ctx, invoice, allocations, cap), priceFinding(ctx, invoice, allocations, cap)].filter(
    (finding): finding is Finding => finding !== null,
  );
};
