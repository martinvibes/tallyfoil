/**
 * Deterministic usage-export parser. Sums token counts per model, direction
 * and calendar month into meters named "<model> input" / "<model> output".
 * No AI reads the CSV: the numbers the audit compares against come from here.
 */

import { parseCsv } from "./csv";
import { endOfMonth, startOfMonth } from "./dates";

export interface UsageTotal {
  meter: string;
  periodStart: string;
  periodEnd: string;
  quantity: number;
}

export type UsageParseResult =
  | { ok: true; totals: UsageTotal[] }
  | { ok: false; errorCode: "missing_columns"; message: string; details: { missing: string[] } }
  | { ok: false; errorCode: "invalid_rows"; message: string; details: { lines: number[] } };

const REQUIRED_COLUMNS = ["date", "model", "input_tokens", "output_tokens"] as const;
const DIRECTIONS = [
  ["input_tokens", "input"],
  ["output_tokens", "output"],
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_COUNT = /^\d+$/;

export const parseUsageExport = (csv: string): UsageParseResult => {
  const [header, ...rows] = parseCsv(csv).filter((record) => record.fields.some((f) => f.trim() !== ""));
  const columns = (header?.fields ?? []).map((name) => name.trim().toLowerCase());
  const column = (name: string) => columns.indexOf(name);

  const missing = REQUIRED_COLUMNS.filter((name) => column(name) < 0);
  if (missing.length > 0) {
    return {
      ok: false,
      errorCode: "missing_columns",
      message: `The export is missing required columns: ${missing.join(", ")}.`,
      details: { missing },
    };
  }

  const sums = new Map<string, UsageTotal>();
  const invalidLines: number[] = [];

  for (const { line, fields } of rows) {
    const value = (name: string) => (fields[column(name)] ?? "").trim();
    const date = value("date");
    const model = value("model");
    const counts = DIRECTIONS.map(([name]) => value(name));

    if (!ISO_DATE.test(date) || !model || !counts.every((c) => TOKEN_COUNT.test(c))) {
      invalidLines.push(line);
      continue;
    }

    DIRECTIONS.forEach(([, direction], i) => {
      const meter = `${model} ${direction}`;
      const periodStart = startOfMonth(date);
      const key = `${meter}|${periodStart}`;
      const total = sums.get(key) ?? { meter, periodStart, periodEnd: endOfMonth(date), quantity: 0 };
      total.quantity += Number(counts[i]);
      sums.set(key, total);
    });
  }

  if (invalidLines.length > 0) {
    return {
      ok: false,
      errorCode: "invalid_rows",
      message: `Rows need an ISO date, a model and whole-number token counts. Check lines ${invalidLines.join(", ")}.`,
      details: { lines: invalidLines },
    };
  }

  const totals = [...sums.values()].sort(
    (a, b) => a.meter.localeCompare(b.meter) || a.periodStart.localeCompare(b.periodStart),
  );
  return { ok: true, totals };
};
