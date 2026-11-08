/**
 * Input schemas shared by the recording actions. The descriptions are what
 * the agent reads, so they carry the units and the evidence rules.
 */

import { z } from "zod";

import { TERM_KEYS } from "./format.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date like 2026-04-01.")
  .describe("ISO date, YYYY-MM-DD");

const rawValue = z.union([z.string(), z.number(), z.boolean()]);

const quotes = z
  .array(z.string().min(1))
  .min(1)
  .max(3)
  .describe("1–3 exact quotes copied from the document text (line-number prefixes are ignored)");

export const termItemSchema = z.object({
  key: z.enum(TERM_KEYS).describe("Which contract term this is"),
  meter: z
    .string()
    .optional()
    .describe('Only for meter_rate: the meter, "<model> input" or "<model> output", e.g. "halcyon-small input"'),
  value: rawValue.describe(
    'The value as the document states it: "24.00" (seat_price, USD per seat per month), "40" (seat_cap), "5%" (renewal_uplift_cap_bps), ' +
      '"January 31, 2026" or "2026-01-31" (term_start/term_end), "yes"/"no" (auto_renew), "60" (notice_days), ' +
      '"0.25" (meter_rate, USD per 1M tokens), "usage_export" (billing_basis)',
  ),
  effectiveFrom: isoDate.optional().describe("Only when the document says the value starts later, e.g. an agreed price change"),
  effectiveTo: isoDate.optional().describe("Only when the document says the value ends on a date"),
  quotes: quotes.describe("1–3 exact quotes from the document that state this value"),
});

export const lineItemSchema = z.object({
  kind: z
    .enum(["seats", "usage", "other"])
    .optional()
    .describe('"seats" per-seat charges, "usage" metered charges (needs meter), "other" tax, fees, credits. Default: usage when meter is set, else seats'),
  description: z.string().min(1).describe("The line's description as printed"),
  meter: z.string().optional().describe('Usage lines only: "<model> input" or "<model> output", e.g. "halcyon-large input"'),
  quantity: z
    .union([z.number(), z.string()])
    .describe("Seats, or the FULL token count — a table in millions (412) is 412000000"),
  unitPrice: rawValue.describe("Unit price as printed: USD per seat, or USD per 1M tokens"),
  amount: rawValue.describe("Line amount as printed, in USD"),
  quotes: quotes.describe("1–3 exact quotes showing the quantity, unit price and amount — usually the table row"),
});

export const invoiceItemSchema = z.object({
  invoiceNumber: z.string().min(1).describe("Invoice number exactly as printed"),
  invoiceDate: isoDate.describe("Invoice date (ISO)"),
  periodStart: isoDate.describe("First day of the billing period (ISO)"),
  periodEnd: isoDate.describe("Last day of the billing period (ISO)"),
  total: rawValue.describe("Total due as printed, in USD"),
  totalQuotes: quotes.describe("Quote(s) containing the total due"),
  periodQuotes: quotes.describe('Quote(s) showing the period dates, or the month name ("October 2026")'),
  lines: z.array(lineItemSchema).min(1).max(40).describe("Every line on the invoice, including tax and fees"),
});
