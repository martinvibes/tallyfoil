/**
 * Turn an uploaded file into plain text in the browser. Actions only ever
 * receive text: PDFs are read here with pdf.js, everything else as UTF-8.
 */

export type DocumentKind = "contract" | "amendment" | "invoice" | "usage_export" | "note";

export interface ExtractedFile {
  name: string;
  text: string;
  kind: DocumentKind;
}

interface PositionedText {
  x: number;
  y: number;
  str: string;
}

/** Group text runs by baseline (rounded y), left to right, so a table row stays on one line. */
const pageLines = (items: readonly PositionedText[]): string[] => {
  const rows = new Map<number, PositionedText[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.y);
    rows.set(y, [...(rows.get(y) ?? []), item]);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str.trim())
        .join(" "),
    );
};

const readPdf = async (file: File): Promise<string> => {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const content = await (await pdf.getPage(number)).getTextContent();
    const items = content.items.flatMap((item) =>
      "str" in item ? [{ x: item.transform[4] as number, y: item.transform[5] as number, str: item.str }] : [],
    );
    pages.push(pageLines(items).join("\n"));
  }
  return pages.map((text, index) => (index === 0 ? text : `--- page ${index + 1} ---\n\n${text}`)).join("\n\n");
};

/** A best guess from the file name; the user can change it before upload. */
export const guessKind = (name: string): DocumentKind => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "usage_export";
  if (/amend/.test(lower)) return "amendment";
  if (/(contract|agreement|order[-_ ]?form|msa|terms)/.test(lower)) return "contract";
  if (/(invoice|inv[-_ ]?\d|bill|receipt|statement)/.test(lower)) return "invoice";
  return "note";
};

export const extractText = async (file: File): Promise<ExtractedFile> => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const text = isPdf ? await readPdf(file) : await file.text();
  return { name: file.name, text: text.trim(), kind: guessKind(file.name) };
};
