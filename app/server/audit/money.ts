const notImplemented = (): never => {
  throw new Error("not implemented");
};

export const decimalToMicros = (_input: string): bigint => notImplemented();
export const parseUsd = (_input: string): number => notImplemented();
export const usdToMicros = (_input: string): number => notImplemented();
export const centsFromMicros = (_micros: bigint | number): number => notImplemented();
export const tokenCostCents = (_tokens: number, _rateMicrosPer1M: number): number =>
  notImplemented();
export const formatUsd = (_cents: number): string => notImplemented();
export const formatMicros = (_micros: number): string => notImplemented();
