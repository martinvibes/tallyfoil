export interface MoneyToken {
  text: string;
  cents: number;
  index: number;
}

export interface AmountCheck {
  ok: boolean;
  offending: MoneyToken[];
}

export const findMoneyTokens = (_text: string): MoneyToken[] => {
  throw new Error("not implemented");
};

export const checkAmounts = (_text: string, _allowedCents: readonly number[]): AmountCheck => {
  throw new Error("not implemented");
};
