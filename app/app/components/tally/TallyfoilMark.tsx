import { cn } from "@/lib/utils";

/**
 * The Tallyfoil mark: a tally stick split in two (the white halves) with the
 * notch line between them in red. Same drawing as public/favicon.svg.
 */
export function TallyfoilMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-6 shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0b0b0d" />
      <path d="M9 50 L23 14 H32 L18 50 Z" fill="#fff" />
      <path d="M32 50 L46 14 H55 L41 50 Z" fill="#fff" />
      <path
        d="M25 50 L29.9 44 L27.1 38 L34.6 32 L31.7 26 L39.3 20 L39 14"
        fill="none"
        stroke="#ff5a36"
        strokeWidth="2.8"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
    </svg>
  );
}
