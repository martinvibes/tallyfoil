import type { Waivers } from "../rules";
import type { TermBook } from "../terms";
import type { InvoiceLineInput, LineKind, VendorInput } from "../types";

/** What every check reads: the vendor, its effective contract and the waivers in force. */
export interface CheckContext {
  vendor: VendorInput;
  book: TermBook;
  waivers: Waivers;
}

export const lineKind = (line: InvoiceLineInput): LineKind => line.kind ?? (line.meter ? "usage" : "seats");
