import { setClientAppState } from "@agent-native/core/client/application-state";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconArrowLeft } from "@tabler/icons-react";
import { useMemo, useRef } from "react";
import { Link, useParams } from "react-router";

import { type DocumentView } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { pathForLocation } from "@shared/routes";

import { LedgerHeading, SampleBadge } from "./primitives";

type Mark = DocumentView["marks"][number];

interface Run {
  text: string;
  start: number;
  mark?: Mark;
}

/** Split one line into plain runs and marked runs (first mark wins on overlap). */
const runsFor = (line: string, lineStart: number, marks: readonly Mark[]): Run[] => {
  const lineEnd = lineStart + line.length;
  const runs: Run[] = [];
  let cursor = lineStart;
  for (const mark of marks) {
    if (mark.end <= cursor || mark.start >= lineEnd) continue;
    const from = Math.max(mark.start, cursor);
    const to = Math.min(mark.end, lineEnd);
    if (from > cursor) runs.push({ text: line.slice(cursor - lineStart, from - lineStart), start: cursor });
    runs.push({ text: line.slice(from - lineStart, to - lineStart), start: from, mark });
    cursor = to;
  }
  if (cursor < lineEnd) runs.push({ text: line.slice(cursor - lineStart), start: cursor });
  return runs;
};

export function DocumentPage() {
  const { documentId = "" } = useParams();
  const { data, isLoading } = useActionQuery<DocumentView>("get-document", { documentId }, { enabled: Boolean(documentId) });
  const textRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    if (!data) return [];
    let offset = 0;
    return data.document.text.split("\n").map((line) => {
      const start = offset;
      offset += line.length + 1;
      return { line, start, runs: runsFor(line, start, data.marks) };
    });
  }, [data]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Opening the document…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">This document isn&rsquo;t on your ledger.</div>;

  /** Map the browser selection back to character offsets so the agent can act on "this". */
  const captureSelection = () => {
    const selection = window.getSelection();
    const root = textRef.current;
    if (!selection || selection.isCollapsed || !root || selection.rangeCount === 0) return;
    const offsetOf = (node: Node, offset: number) => {
      const element = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element))?.closest<HTMLElement>("[data-start]");
      return element ? Number(element.dataset.start) + offset : null;
    };
    const range = selection.getRangeAt(0);
    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) return;
    void setClientAppState("selection", {
      kind: "document-range",
      vendorId: data.vendor.id,
      documentId: data.document.id,
      start,
      end,
      label: data.document.text.slice(start, end).slice(0, 120),
    });
  };

  const quoted = data.marks.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 md:px-8">
      <header className="space-y-2">
        <Link to={pathForLocation({ view: "vendor", vendorId: data.vendor.id })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <IconArrowLeft className="size-3.5" /> {data.vendor.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="ledger-numeral text-2xl font-medium md:text-3xl">{data.document.name}</h1>
          {data.document.isSample && <SampleBadge />}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <LedgerHeading>{data.document.kind.replace("_", " ")}</LedgerHeading>
          <span>{lines.length} lines</span>
          <span>
            {quoted} quote{quoted === 1 ? "" : "s"} recorded from it
          </span>
          <span className="flex items-center gap-1.5">
            <mark className="evidence-mark-bill px-1">billed</mark>
            <mark className="evidence-mark-agreed px-1">agreed</mark>
          </span>
          <span>Select text to ask the agent about it.</span>
        </div>
      </header>

      <div className="overflow-hidden rounded-md border border-rule bg-card">
        <div ref={textRef} onMouseUp={captureSelection} onKeyUp={captureSelection} className="overflow-x-auto py-3 font-figure text-[13px] leading-6">
          {lines.map(({ line, start, runs }, index) => (
            <div key={start} className="flex hover:bg-shade/50">
              <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground/60">{index + 1}</span>
              <span className="whitespace-pre pr-6" data-start={start}>
                {line.length === 0
                  ? " "
                  : runs.map((run) =>
                      run.mark ? (
                        <mark
                          key={run.start}
                          data-start={run.start}
                          title={run.mark.label}
                          className={cn(run.mark.tone === "bill" ? "evidence-mark-bill" : "evidence-mark-agreed", "cursor-help")}
                        >
                          {run.text}
                        </mark>
                      ) : (
                        <span key={run.start} data-start={run.start}>
                          {run.text}
                        </span>
                      ),
                    )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
