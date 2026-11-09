/**
 * A dispute email in two parts: prose the agent (or user) writes, and an
 * evidence table and total that only code writes. The number guard keeps
 * the prose from stating any amount the code did not compute.
 */

import { formatUsd } from "../audit/money.js";
import { type MoneyToken, checkAmounts } from "../audit/number-guard.js";

export interface DisputeLine {
  periodStart: string;
  periodLabel: string;
  invoiceNumber: string | null;
  issue: string;
  explanation: string;
  amountCents: number;
}

export interface Prose {
  subject: string;
  intro: string;
  closing: string;
}

export interface ComposedDispute {
  tableMd: string;
  tableText: string;
  totalCents: number;
  body: string;
}

const sorted = (lines: readonly DisputeLine[]) => [...lines].sort((a, b) => a.periodStart.localeCompare(b.periodStart));

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

export const composeDispute = (lines: readonly DisputeLine[], prose: Prose): ComposedDispute => {
  const rows = sorted(lines);
  const totalCents = rows.reduce((sum, line) => sum + line.amountCents, 0);

  const tableMd = [
    "| Period | Invoice | Issue | Amount |",
    "| --- | --- | --- | ---: |",
    ...rows.map((line) => `| ${cell(line.periodLabel)} | ${cell(line.invoiceNumber ?? "—")} | ${cell(line.issue)} | ${formatUsd(line.amountCents)} |`),
    `| **Total** | | | **${formatUsd(totalCents)}** |`,
  ].join("\n");

  const tableText = rows
    .map((line) => `- ${line.periodLabel}${line.invoiceNumber ? `, ${line.invoiceNumber}` : ""}: ${line.issue} — ${formatUsd(line.amountCents)}\n  ${line.explanation}`)
    .join("\n");

  const body = `${prose.intro.trim()}\n\n${tableText}\n\nTotal: ${formatUsd(totalCents)}\n\n${prose.closing.trim()}`;
  return { tableMd, tableText, totalCents, body };
};

export interface GuardResult {
  ok: boolean;
  offending: Array<MoneyToken & { field: keyof Prose }>;
}

/** Every amount in the prose must be the total or one of the itemized amounts. */
export const guardProse = (prose: Prose, lines: readonly DisputeLine[]): GuardResult => {
  const allowed = [...lines.map((line) => line.amountCents), lines.reduce((sum, line) => sum + line.amountCents, 0)];
  const fields: Array<keyof Prose> = ["subject", "intro", "closing"];
  const offending = fields.flatMap((field) => checkAmounts(prose[field], allowed).offending.map((token) => ({ ...token, field })));
  return { ok: offending.length === 0, offending };
};
