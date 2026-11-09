import { useMemo, useState } from "react";

import { formatUsd } from "@/lib/tally";
import { cn } from "@/lib/utils";

export interface MirrorMonth {
  month: string;
  label: string;
  billedCents: number;
  overchargeCents: number;
  topFinding?: { id: string; vendorId: string; title: string } | null;
}

const W = 1000;
const ECHOES = 18;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const shortMonth = (month: string) => {
  const [year, m] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${year?.slice(2)}`;
};

/** Deterministic dust for the background, so server and client render the same sky. */
const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: hash(i * 4 + 1) * 100,
  y: hash(i * 4 + 2) * 100,
  size: hash(i * 4 + 3) > 0.9 ? 2 : 1,
  opacity: 0.12 + hash(i * 4 + 4) * 0.45,
}));

/** A smooth curve through points (Catmull-Rom as cubic Béziers). */
const smooth = (points: ReadonlyArray<[number, number]>) => {
  let d = `M${points[0]?.[0] ?? 0},${points[0]?.[1] ?? 0}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
};

/**
 * The bill and the agreement as mirror images. Above the axis: what the
 * vendor billed each month. Below: what the contract allowed. An honest
 * month is perfectly symmetric; an overcharge breaks the mirror, and the
 * gap glows red. Every height is a real amount from the engine.
 */
export function MirrorChart({
  months,
  height = 320,
  onSelect,
  className,
}: {
  months: MirrorMonth[];
  height?: number;
  onSelect?: (month: MirrorMonth) => void;
  className?: string;
}) {
  const H = height;
  const mid = H / 2;
  const reach = mid - 18;
  const n = Math.max(months.length, 1);
  const step = W / n;
  const largest = useMemo(
    () => months.reduce((best, m, i) => (m.overchargeCents > (months[best]?.overchargeCents ?? 0) ? i : best), 0),
    [months],
  );
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? largest;

  /**
   * Heights are billed ÷ agreed, so every vendor shares one scale: an honest
   * month sits exactly on the mirror line; July's duplicate bill stands twice
   * as tall as what was agreed. Exact amounts live in the scrubber.
   */
  const BASE = 0.42;
  const CAP = 2.3;
  const ratio = (m: MirrorMonth) => {
    const agreed = m.billedCents - m.overchargeCents;
    if (m.billedCents === 0) return 0;
    return agreed <= 0 ? CAP : Math.min(CAP, m.billedCents / agreed);
  };
  const billedLevel = months.map((m) => (m.billedCents === 0 ? 0 : BASE * ratio(m)));
  const agreedLevel = months.map((m) => (m.billedCents === 0 ? 0 : BASE));
  const scale = reach / (BASE * CAP);

  const xs = months.map((_, i) => (i + 0.5) * step);
  const curve = (levels: number[], sign: 1 | -1, k = 1) =>
    smooth([[0, mid], ...levels.map((level, i): [number, number] => [xs[i] ?? 0, mid - sign * level * scale * k]), [W, mid]]);
  /** The gap: billed curve out, agreed curve back. */
  const gapArea = () => {
    const out = curve(billedLevel, 1);
    const back = smooth([[W, mid], ...[...agreedLevel].reverse().map((level, j): [number, number] => [xs[months.length - 1 - j] ?? 0, mid - level * scale]), [0, mid]]);
    return `${out} L${W},${mid} ${back.replace(/^M/, "L")} Z`;
  };

  const flaggedCount = months.filter((m) => m.overchargeCents > 0).length;
  const current = months[shown];
  /** Slide the pill by its own width as it travels, so it never leaves the panel on a phone. */
  const pillAt = ((shown + 0.5) / n) * 100;

  if (months.length === 0) return null;

  return (
    <div
      className={cn("relative overflow-hidden select-none", className)}
      style={{ height: H }}
      role="group"
      aria-label={`${flaggedCount} of ${months.length} months billed above what was agreed`}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {STARS.map((star, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, opacity: star.opacity }}
          />
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="mirror-gap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d2e" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff4d2e" stopOpacity="0.15" />
          </linearGradient>
          <filter id="mirror-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <clipPath id="mirror-flagged">
          {months.map((m, i) => (m.overchargeCents > 0 ? <rect key={m.month} x={i * step} y="0" width={step} height={mid} /> : null))}
        </clipPath>

        {/* Contour echoes, rising out of the axis */}
        {Array.from({ length: ECHOES }, (_, e) => {
          const k = (e + 1) / ECHOES;
          return (
            <g key={e} className="mirror-rise" style={{ animationDelay: `${e * 30}ms` }}>
              <path d={curve(billedLevel, 1, k)} fill="none" stroke="#ff8a6b" strokeOpacity={0.04 + k * 0.17} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d={curve(agreedLevel, -1, k)} fill="none" stroke="#45d4bf" strokeOpacity={0.04 + k * 0.17} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}

        <g className="mirror-rise" style={{ animationDelay: `${ECHOES * 30}ms` }}>
          <path d={gapArea()} fill="url(#mirror-gap)" className="mirror-pulse" />
          {/* What should have been billed, reflected up from your half */}
          <path d={curve(agreedLevel, 1)} fill="none" stroke="#45d4bf" strokeOpacity="0.75" strokeDasharray="5 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={curve(billedLevel, 1)} fill="none" stroke="#f6efe4" strokeOpacity="0.9" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path d={curve(billedLevel, 1)} fill="none" stroke="#ff4d2e" strokeWidth="2.5" clipPath="url(#mirror-flagged)" filter="url(#mirror-glow)" vectorEffect="non-scaling-stroke" />
          <path d={curve(agreedLevel, -1)} fill="none" stroke="#45d4bf" strokeOpacity="0.95" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>

        <line x1="0" x2={W} y1={mid} y2={mid} stroke="#45d4bf" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {current && (
          <line
            x1={(shown + 0.5) * step}
            x2={(shown + 0.5) * step}
            y1="8"
            y2={H - 8}
            stroke="#f6efe4"
            strokeOpacity="0.35"
            strokeDasharray="2 3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Month ticks under the axis */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex font-figure text-[10px] uppercase tracking-wider text-white/35" aria-hidden="true">
        {months.map((m, i) => (
          <span key={m.month} className={cn("flex-1 text-center", i === shown && "text-white/80")}>
            {n > 14 && i % 2 === 1 ? "" : shortMonth(m.month).split(" ")[0]}
          </span>
        ))}
      </div>

      {/* The scrubber pill rides the axis, like a price on a depth chart */}
      {current && (
        <div
          className="pointer-events-none absolute z-10 transition-[left,transform] duration-150 ease-out"
          style={{ left: `${pillAt}%`, top: mid, transform: `translate(-${pillAt}%, -50%)` }}
          aria-live="polite"
        >
          <div className={cn("whitespace-nowrap rounded-md border bg-[#0b0b0d]/95 px-3 py-1.5 text-center font-figure shadow-xl backdrop-blur", current.overchargeCents > 0 ? "border-[#ff4d2e]/60" : "border-[#45d4bf]/50")}>
            <div className="text-xs">
              <span className="text-white/50">{shortMonth(current.month).toUpperCase()}</span>
              {current.overchargeCents > 0 ? (
                <span className="ml-2 font-medium text-[#ff6a4d]">+{formatUsd(current.overchargeCents)}</span>
              ) : current.billedCents > 0 ? (
                <span className="ml-2 text-[#45d4bf]">matches</span>
              ) : (
                <span className="ml-2 text-white/40">no bill</span>
              )}
            </div>
            {current.billedCents > 0 && (
              <div className="mt-0.5 text-[10px] text-white/45">
                billed {formatUsd(current.billedCents)} · agreed {formatUsd(current.billedCents - current.overchargeCents)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* One focusable column per month: hover or arrow through, click to open the proof */}
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <button
            key={m.month}
            type="button"
            className={cn("h-full flex-1 outline-none focus-visible:bg-white/5", m.overchargeCents > 0 && onSelect ? "cursor-pointer" : "cursor-crosshair")}
            aria-label={`${m.label}: billed ${formatUsd(m.billedCents)}${m.overchargeCents > 0 ? `, ${formatUsd(m.overchargeCents)} above what was agreed` : ", matches what was agreed"}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => m.overchargeCents > 0 && onSelect?.(m)}
          />
        ))}
      </div>
    </div>
  );
}
