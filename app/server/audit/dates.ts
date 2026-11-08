/**
 * Calendar helpers on ISO `YYYY-MM-DD` strings. All arithmetic is done in UTC
 * so results never depend on the server's time zone.
 */

const DAY_MS = 86_400_000;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_PATTERN =
  "january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec";

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const MONTH_FIRST = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi");
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\.?,?\\s+(\\d{4})\\b`, "gi");

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

const toIso = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

const parts = (iso: string): [number, number, number] => [
  Number(iso.slice(0, 4)),
  Number(iso.slice(5, 7)),
  Number(iso.slice(8, 10)),
];

const monthName = (month: number): string => MONTH_NAMES[month - 1] ?? String(month);

const toUtcMs = (iso: string) => {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
};

const fromUtcMs = (ms: number) => {
  const date = new Date(ms);
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const monthIndex = (name: string) => {
  const lower = name.toLowerCase();
  return MONTH_NAMES.findIndex((full) => full.toLowerCase().startsWith(lower.slice(0, 3)));
};

const validIso = (year: number, month: number, day: number): string | null =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month) ? toIso(year, month, day) : null;

export const addDays = (iso: string, days: number): string => fromUtcMs(toUtcMs(iso) + days * DAY_MS);

export const addMonths = (iso: string, months: number): string => {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return toIso(year, month, Math.min(d, daysInMonth(year, month)));
};

export const daysBetween = (from: string, to: string): number => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);

export const startOfMonth = (iso: string): string => `${iso.slice(0, 8)}01`;

export const endOfMonth = (iso: string): string => {
  const [y, m] = parts(iso);
  return toIso(y, m, daysInMonth(y, m));
};

/** "2 Dec 2026". */
export const formatLongDate = (iso: string): string => {
  const [y, m, d] = parts(iso);
  return `${d} ${monthName(m).slice(0, 3)} ${y}`;
};

/** "February 2026" for a whole calendar month, otherwise "15 Feb 2026 – 14 Mar 2026". */
export const periodLabel = (start: string, end: string): string => {
  if (start === startOfMonth(start) && end === endOfMonth(start)) {
    const [y, m] = parts(start);
    return `${monthName(m)} ${y}`;
  }
  return `${formatLongDate(start)} – ${formatLongDate(end)}`;
};

/** Every valid date written in the text, as ISO strings, in reading order. */
export const findDatesInText = (text: string): string[] => {
  const found: Array<{ index: number; iso: string }> = [];

  const add = (index: number | undefined, iso: string | null) => {
    if (iso && index !== undefined) found.push({ index, iso });
  };

  for (const { 1: year = "", 2: month = "", 3: day = "", index } of text.matchAll(ISO_DATE)) {
    add(index, validIso(Number(year), Number(month), Number(day)));
  }
  for (const { 1: month = "", 2: day = "", 3: year = "", index } of text.matchAll(MONTH_FIRST)) {
    add(index, validIso(Number(year), monthIndex(month) + 1, Number(day)));
  }
  for (const { 1: day = "", 2: month = "", 3: year = "", index } of text.matchAll(DAY_FIRST)) {
    add(index, validIso(Number(year), monthIndex(month) + 1, Number(day)));
  }

  return found.sort((a, b) => a.index - b.index).map((f) => f.iso);
};
