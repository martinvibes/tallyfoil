/** The lines around a quoted span, so a reader sees the quote in its place in the document. */
export interface Excerpt {
  text: string;
  /** 1-based line number of the first line in `text`. */
  firstLine: number;
  highlightStart: number;
  highlightEnd: number;
}

export const excerpt = (document: string, start: number, end: number, padLines = 2): Excerpt => {
  const from = Math.max(0, Math.min(start, document.length));
  const to = Math.max(from, Math.min(end, document.length));

  let sliceStart = document.lastIndexOf("\n", from - 1) + 1;
  for (let i = 0; i < padLines && sliceStart > 0; i++) sliceStart = document.lastIndexOf("\n", sliceStart - 2) + 1;

  let sliceEnd = to;
  for (let i = 0; i <= padLines && sliceEnd < document.length; i++) {
    const next = document.indexOf("\n", i === 0 ? sliceEnd : sliceEnd + 1);
    sliceEnd = next === -1 ? document.length : next;
  }

  return {
    text: document.slice(sliceStart, sliceEnd),
    firstLine: document.slice(0, sliceStart).split("\n").length,
    highlightStart: from - sliceStart,
    highlightEnd: to - sliceStart,
  };
};
