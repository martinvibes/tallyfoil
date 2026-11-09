import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type VendorDetail, formatUsd } from "@/lib/tally";

type Notch = VendorDetail["timeline"][number];

/**
 * One notch per billed month, like a medieval tally stick. A month that was
 * overcharged is cut through in notch red; a month with no bill is a gap.
 */
export function TallyStick({ notches, onSelect }: { notches: Notch[]; onSelect?: (notch: Notch) => void }) {
  if (notches.length === 0) return null;
  const overcharged = notches.filter((n) => n.overchargeCents > 0).length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">The tally</p>
        <p className="text-xs text-muted-foreground">
          {overcharged} of {notches.length} months overcharged
        </p>
      </div>
      <div className="relative flex h-16 items-stretch gap-1 rounded-sm border border-rule bg-card px-2 py-2" role="list" aria-label="Monthly billing tally">
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px bg-rule" aria-hidden="true" />
        {notches.map((notch) => {
          const flagged = notch.overchargeCents > 0;
          const missing = notch.billedCents === 0;
          const label = `${notch.label}: ${missing ? "no bill" : `billed ${formatUsd(notch.billedCents)}`}${flagged ? `, ${notch.overcharge} overcharged` : ""}`;
          return (
            <Tooltip key={notch.month}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="listitem"
                  aria-label={label}
                  disabled={!flagged || !onSelect}
                  onClick={() => onSelect?.(notch)}
                  className={cn(
                    "group relative flex min-w-0 flex-1 items-center justify-center rounded-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    flagged ? "cursor-pointer hover:bg-notch/10" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "h-full w-[3px] rounded-full",
                      missing ? "border-l border-dashed border-muted-foreground/40 bg-transparent" : flagged ? "bg-foreground" : "bg-foreground/70",
                    )}
                  />
                  {flagged && (
                    <span className="absolute left-1/2 top-1/2 h-[3px] w-4 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] rounded-full bg-notch" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{notches[0]?.label}</span>
        <span>{notches[notches.length - 1]?.label}</span>
      </div>
    </div>
  );
}
