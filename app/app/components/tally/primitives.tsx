import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { formatUsd, spokenUsd } from "@/lib/tally";

/** An amount in cents, set in tabular figures with a spoken label. */
export function Money({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("figure", className)} aria-label={spokenUsd(cents)}>
      {formatUsd(cents)}
    </span>
  );
}

/** Counts from the last shown value to the new one over ~600ms. */
export function CountUpMoney({ cents, className }: { cents: number; className?: string }) {
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);

  useEffect(() => {
    const start = from.current;
    if (start === cents) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = cents;
      setShown(cents);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 600);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(start + (cents - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = cents;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = cents;
    };
  }, [cents]);

  return (
    <span className={cn("ledger-numeral", className)} aria-label={spokenUsd(cents)} aria-live="polite">
      {formatUsd(shown)}
    </span>
  );
}

/** The mark: a tally stick split by a notched line. */
export function SampleBadge() {
  return (
    <span className="rounded-sm border border-dashed border-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
      Sample data
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  open: "border-notch/40 text-notch",
  accepted: "border-notch bg-notch/10 text-notch -rotate-2 border-double border-[3px] font-bold",
  rejected: "border-border text-muted-foreground line-through decoration-1",
  explained: "border-border text-muted-foreground",
  cleared: "border-border text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = { accepted: "dispute", rejected: "waived" };

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("rounded-sm border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide", STATUS_STYLE[status])}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const SEVERITY_STYLE: Record<string, string> = {
  breach: "bg-notch",
  verify: "bg-amber",
  deadline: "bg-amber",
};

export function SeverityLabel({ severity }: { severity: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", SEVERITY_STYLE[severity])} />
      {severity}
    </span>
  );
}

const SOURCE_LABEL: Record<string, string> = { agent: "read", user: "you", rule: "rule" };

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1 py-px text-[10px] font-medium uppercase tracking-wide",
        source === "user" ? "bg-amber/15 text-amber" : "bg-shade text-muted-foreground",
      )}
    >
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}

/** A section title in small caps, ledger style. */
export function LedgerHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>{children}</h2>;
}
