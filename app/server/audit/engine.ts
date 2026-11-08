import type { AuditInput, AuditOutput } from "./types";

export const ENGINE_VERSION = "1.0.0";

export const audit = (_input: AuditInput, _asOf: string): AuditOutput => {
  throw new Error("not implemented");
};
