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

const readPdf = async (file: File): Promise<string> => {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = "";
      }
    }
    if (line) lines.push(line.trimEnd());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
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
