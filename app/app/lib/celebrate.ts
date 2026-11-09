import confetti from "canvas-confetti";

/** Brand palettes: notch red and paper for a find, teal and paper for money back. */
const PALETTES = {
  found: ["#d9480f", "#ff6a42", "#f6efe4", "#e0b062"],
  approved: ["#d9480f", "#f6efe4", "#45d4bf"],
  recovered: ["#45d4bf", "#2f9e7f", "#f6efe4", "#e0b062"],
} as const;

export type CelebrationKind = keyof typeof PALETTES;

/**
 * A short confetti burst for the moments that matter: money found, a dispute
 * approved, money recovered. Skipped for people who prefer reduced motion.
 */
export function celebrate(kind: CelebrationKind) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = [...PALETTES[kind]];
  const base = { colors, disableForReducedMotion: true, zIndex: 9999, ticks: 220, scalar: 0.95 };
  void confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 42, origin: { x: 0.5, y: 0.35 } });
  window.setTimeout(() => {
    void confetti({ ...base, particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
    void confetti({ ...base, particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
  }, 180);
}
