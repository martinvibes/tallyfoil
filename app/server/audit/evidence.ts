export type ClaimedValue =
  | { kind: "money"; cents: number }
  | { kind: "decimal"; micros: number }
  | { kind: "integer"; value: number }
  | { kind: "percent"; bps: number }
  | { kind: "date"; iso: string }
  | { kind: "presence" };

export interface FragmentInput {
  quote: string;
}

export interface MatchedFragment {
  quote: string;
  start: number;
  end: number;
}

export type EvidenceErrorCode = "evidence_not_found" | "value_not_in_quote" | "invalid_fragments";

export type EvidenceResult =
  | { ok: true; fragments: MatchedFragment[] }
  | { ok: false; errorCode: EvidenceErrorCode; message: string; quote?: string };

export const locateQuote = (_text: string, _quote: string): { start: number; end: number } | null => {
  throw new Error("not implemented");
};

export const matchEvidence = (
  _text: string,
  _fragments: FragmentInput[],
  _value: ClaimedValue,
): EvidenceResult => {
  throw new Error("not implemented");
};
