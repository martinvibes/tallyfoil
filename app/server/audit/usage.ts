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

export const parseUsageExport = (_csv: string): UsageParseResult => {
  throw new Error("not implemented");
};
