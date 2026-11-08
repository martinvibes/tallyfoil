/**
 * Exact money arithmetic. Amounts are integer cents, unit prices are integer
 * micro-dollars (1e-6 USD). Floats never touch a money value.
 */

const MICROS_PER_UNIT = 1_000_000n;
const MICROS_PER_CENT = 10_000n;
const TOKENS_PER_RATE_UNIT = 1_000_000n;

const DECIMAL = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d+))?$/;
const CURRENCY_AFFIXES = /^(?:US\$|USD|\$)\s*|\s*(?:USD|dollars?)$/gi;

/** Divides and rounds half away from zero. */
export const roundDiv = (numerator: bigint, denominator: bigint): bigint => {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = n / d;
  const rounded = (n % d) * 2n >= d ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
};

/** Parses a plain decimal ("1,255.68", "0.25", "412") into micro-units. */
export const decimalToMicros = (input: string): bigint => {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1).trim() : trimmed;
  const match = DECIMAL.exec(body);
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    throw new Error(`Not a decimal number: "${input}"`);
  }

  const whole = BigInt((match[1] ?? "0").replace(/,/g, ""));
  const fraction = match[2] ?? "";
  const kept = BigInt(fraction.slice(0, 6).padEnd(6, "0"));
  const roundUp = fraction.charAt(6) >= "5";
  const micros = whole * MICROS_PER_UNIT + kept + (roundUp ? 1n : 0n);
  return negative ? -micros : micros;
};

const stripCurrency = (input: string): string => {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const body = (negative ? trimmed.slice(1) : trimmed).replace(CURRENCY_AFFIXES, "").trim();
  return negative ? `-${body}` : body;
};

/** Parses a USD amount ("USD 1,255.68", "$960", "-$38.40") into cents. */
export const parseUsd = (input: string): number => centsFromMicros(decimalToMicros(stripCurrency(input)));

/** Parses a USD unit price ("26.16", "USD 0.25") into micro-dollars. */
export const usdToMicros = (input: string): number => Number(decimalToMicros(stripCurrency(input)));

/** Converts micro-dollars to cents, rounding half a cent away from zero. */
export const centsFromMicros = (micros: bigint | number): number =>
  Number(roundDiv(BigInt(micros), MICROS_PER_CENT));

/** Cost in cents of `tokens` at a rate of `rateMicrosPer1M` micro-dollars per 1M tokens. */
export const tokenCostCents = (tokens: number, rateMicrosPer1M: number): number =>
  Number(roundDiv(BigInt(tokens) * BigInt(rateMicrosPer1M), TOKENS_PER_RATE_UNIT * MICROS_PER_CENT));

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "1,255.68" — cents as a grouped amount without a currency symbol. */
export const formatCents = (cents: number): string => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${groupThousands(String(Math.trunc(abs / 100)))}.${String(abs % 100).padStart(2, "0")}`;
};

/** "$1,255.68" / "-$38.40". */
export const formatUsd = (cents: number): string =>
  cents < 0 ? `-$${formatCents(-cents)}` : `$${formatCents(cents)}`;

/** "26.16", "3.00", "0.0035" — a micro-dollar value with at least two decimals. */
export const formatMicros = (micros: number): string => {
  const sign = micros < 0 ? "-" : "";
  const abs = Math.abs(micros);
  const whole = Math.trunc(abs / 1_000_000);
  const fraction = String(abs % 1_000_000).padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${sign}${groupThousands(String(whole))}.${fraction}`;
};

/** "$26.16" — a micro-dollar unit price with its currency symbol. */
export const formatUsdMicros = (micros: number): string =>
  micros < 0 ? `-$${formatMicros(-micros)}` : `$${formatMicros(micros)}`;

/** "412,000,000" — a whole count (seats, tokens) grouped by thousands. */
export const formatCount = (count: number): string =>
  (count < 0 ? "-" : "") + groupThousands(String(Math.abs(Math.trunc(count))));
