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
export function NotchMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="2" fill="currentColor" opacity="0.12" />
      <path d="M3 12 L6 9.5 L9 12 L12 9.5 L15 12 L18 9.5 L21 12" fill="none" stroke="hsl(var(--notch))" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 4v4M11 4v4M15 4v4M7 16v4M11 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SampleBadge() {
  return (
    <span className="rounded-sm border border-dashed border-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
      Sample data
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  open: "border-notch/40 text-notch",
  accepted: "border-verified/40 bg-verified/10 text-verified",
  rejected: "border-border text-muted-foreground line-through decoration-1",
  explained: "border-border text-muted-foreground",
  cleared: "border-border text-muted-foreground",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("rounded-sm border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide", STATUS_STYLE[status])}>
      {status}
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
