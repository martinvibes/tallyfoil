import type { AuthPageProps, ResetPasswordPageProps } from "@agent-native/core/shared/auth-page-types";
import { renderAuthPage, renderAuthResetPasswordPage } from "@agent-native/toolkit/app/auth/server";

/**
 * Tallyfoil's sign-in and reset pages.
 *
 * The framework renders the auth card and hydrates it with React, so we never
 * touch its markup or props. We append our own nodes after it, inside the root:
 * React leaves trailing root-level nodes alone during hydration. Those nodes are
 * a stylesheet, the story panel (what Tallyfoil does, shown with the labeled
 * sample audit), and a small script that adds show/hide toggles to password
 * fields, a live strength and match hint, and a busy state on submit.
 */

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"/>' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400..600&display=swap"/>';

const STYLES = String.raw`
#agent-native-auth-root {
  --tf-paper: hsl(40 45% 94%);
  --tf-card: hsl(43 100% 99%);
  --tf-ink: hsl(36 10% 10%);
  --tf-muted: hsl(35 9% 39%);
  --tf-rule: hsl(39 31% 84%);
  --tf-shade: hsl(40 40% 90%);
  --tf-notch: hsl(17 88% 40%);
  --tf-on-notch: #fff;
  --tf-verified: hsl(135 26% 33%);
  --tf-amber: hsl(36 71% 42%);
  --tf-danger: hsl(2 64% 42%);
  --tf-serif: "Fraunces", Georgia, serif;
  --tf-mono: "IBM Plex Mono", ui-monospace, monospace;
  --tf-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  #agent-native-auth-root {
    --tf-paper: hsl(43 19% 7%);
    --tf-card: hsl(40 17% 10%);
    --tf-ink: hsl(40 37% 89%);
    --tf-muted: hsl(38 12% 59%);
    --tf-rule: hsl(39 14% 20%);
    --tf-shade: hsl(38 15% 14%);
    --tf-notch: hsl(18 81% 56%);
    --tf-on-notch: hsl(43 19% 7%);
    --tf-verified: hsl(136 23% 54%);
    --tf-amber: hsl(38 65% 57%);
    --tf-danger: hsl(2 72% 66%);
  }
}
body { display: block; padding: 0; min-height: 100vh; background: hsl(40 45% 94%); }
@media (prefers-color-scheme: dark) {
  body { background: hsl(43 19% 7%); }
  #agent-native-auth-root .card { box-shadow: 0 30px 70px -38px rgba(0,0,0,0.9) !important; }
}
#agent-native-auth-root { min-height: 100vh; min-height: 100svh; background: var(--tf-paper); color: var(--tf-ink); font-family: var(--tf-sans); -webkit-font-smoothing: antialiased; }

/* Layout: story on the left, the card on paper on the right. */
.auth-root { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); }
.auth-root > .auth-page { grid-column: 2; grid-row: 1; min-height: 100svh; padding: 2.5rem 1.5rem; }
.auth-root > .tf-story { grid-column: 1; grid-row: 1; }
.auth-wave-background { display: none; }
html[data-agent-native-embedded="1"] .auth-root { grid-template-columns: minmax(0, 1fr); }
html[data-agent-native-embedded="1"] .auth-root > .auth-page { grid-column: 1; }
html[data-agent-native-embedded="1"] .tf-story { display: none; }

/* The card. */
#agent-native-auth-root .card {
  max-width: 420px; padding: 2.25rem 2rem 2rem; border-radius: 18px;
  background: var(--tf-card); border: 1px solid var(--tf-rule);
  box-shadow: 0 1px 0 rgba(255,255,255,0.5) inset, 0 30px 70px -38px rgba(70,45,10,0.38);
  animation: tf-rise 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
#agent-native-auth-root .card::before {
  content: ""; display: block; width: 44px; height: 10px; margin-bottom: 1.25rem;
  background: var(--tf-notch);
  clip-path: polygon(0 100%, 12.5% 0, 25% 100%, 37.5% 0, 50% 100%, 62.5% 0, 75% 100%, 87.5% 0, 100% 100%, 100% 100%, 0 100%);
}
#agent-native-auth-root h1 { font-family: var(--tf-serif); font-weight: 500; font-size: 2rem; line-height: 1.1; letter-spacing: -0.02em; color: var(--tf-ink); margin-bottom: 0.375rem; }
#agent-native-auth-root .subtitle { font-size: 0.9rem; color: var(--tf-muted); margin-bottom: 1.5rem; }
#agent-native-auth-root .tabs { padding: 4px; margin-bottom: 1.5rem; background: var(--tf-shade); border-radius: 12px; }
#agent-native-auth-root .tab { padding: 0.55rem 0.75rem; border-radius: 9px; color: var(--tf-muted); font-size: 0.85rem; font-weight: 500; transition: background 160ms, color 160ms, box-shadow 160ms; }
#agent-native-auth-root .tab.active { background: var(--tf-card); color: var(--tf-ink); box-shadow: 0 1px 2px rgba(40,25,5,0.12), 0 0 0 1px var(--tf-rule); }
#agent-native-auth-root .tab:hover:not(.active) { color: var(--tf-ink); }
#agent-native-auth-root label { font-size: 0.8125rem; font-weight: 500; color: var(--tf-ink); margin-bottom: 0.4rem; }
#agent-native-auth-root input:not([type="checkbox"]):not([type="radio"]) {
  display: block; height: 2.75rem; padding: 0 0.9rem; margin-bottom: 1rem;
  background: var(--tf-paper); color: var(--tf-ink); border: 1px solid var(--tf-rule); border-radius: 11px;
  font: 400 0.9375rem/1 var(--tf-sans); transition: border-color 140ms, box-shadow 140ms, background 140ms;
}
#agent-native-auth-root input::placeholder { color: var(--tf-muted); opacity: 0.7; }
#agent-native-auth-root input:hover { border-color: color-mix(in srgb, var(--tf-ink) 25%, var(--tf-rule)); }
#agent-native-auth-root input:focus { background: var(--tf-card); border-color: var(--tf-notch); box-shadow: 0 0 0 4px color-mix(in srgb, var(--tf-notch) 14%, transparent); }
#agent-native-auth-root input:user-invalid { border-color: var(--tf-danger); }
#agent-native-auth-root input[data-tf-eye] { padding-right: 3rem; }
#agent-native-auth-root button[type="submit"], #agent-native-auth-root .btn-primary {
  position: relative; height: 2.875rem; margin-top: 0.5rem; padding: 0 1rem; border-radius: 11px;
  background: var(--tf-notch); color: var(--tf-on-notch); font: 600 0.9375rem/1 var(--tf-sans); letter-spacing: 0.01em;
  box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 10px 24px -12px color-mix(in srgb, var(--tf-notch) 80%, transparent);
  transition: filter 140ms, transform 80ms, box-shadow 140ms;
}
#agent-native-auth-root button[type="submit"]:hover, #agent-native-auth-root .btn-primary:hover { background: var(--tf-notch); filter: brightness(1.08); }
#agent-native-auth-root button[type="submit"]:active, #agent-native-auth-root .btn-primary:active { transform: translateY(1px); }
#agent-native-auth-root button:focus-visible { outline: 2px solid var(--tf-notch); outline-offset: 2px; }
#agent-native-auth-root button[type="submit"]:disabled { opacity: 0.6; }
#agent-native-auth-root button[data-tf-busy] { color: transparent !important; pointer-events: none; }
#agent-native-auth-root button[data-tf-busy]::after {
  content: ""; position: absolute; inset: 0; margin: auto; width: 1.15rem; height: 1.15rem; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--tf-on-notch) 35%, transparent); border-top-color: var(--tf-on-notch);
  animation: tf-spin 700ms linear infinite;
}
#agent-native-auth-root .btn-secondary, #agent-native-auth-root .btn-google {
  height: 2.75rem; border-radius: 11px; background: var(--tf-card); color: var(--tf-ink); border: 1px solid var(--tf-rule); font-weight: 500;
}
#agent-native-auth-root .btn-secondary:hover, #agent-native-auth-root .btn-google:hover { background: var(--tf-shade); color: var(--tf-ink); }
#agent-native-auth-root .divider { color: var(--tf-muted); }
#agent-native-auth-root .divider::before, #agent-native-auth-root .divider::after { background: var(--tf-rule); }
#agent-native-auth-root .link-button, #agent-native-auth-root .back { color: var(--tf-muted); }
#agent-native-auth-root .link-button:hover, #agent-native-auth-root .back:hover { color: var(--tf-ink); }
#agent-native-auth-root .legal-note, #agent-native-auth-root .legal-note a { color: var(--tf-muted); }

/* Errors and success: a real alert, not a line of red text. */
#agent-native-auth-root .msg.show {
  display: flex; gap: 0.6rem; align-items: flex-start; margin-top: 1rem; padding: 0.7rem 0.85rem;
  border-radius: 11px; font-size: 0.85rem; line-height: 1.45; animation: tf-pop 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
#agent-native-auth-root .msg.show::before {
  flex: none; display: grid; place-items: center; width: 1.25rem; height: 1.25rem; border-radius: 50%;
  font: 700 0.75rem/1 var(--tf-sans); color: var(--tf-card);
}
#agent-native-auth-root .msg.show.error { color: var(--tf-danger); background: color-mix(in srgb, var(--tf-danger) 9%, var(--tf-card)); border: 1px solid color-mix(in srgb, var(--tf-danger) 30%, transparent); animation-name: tf-shake; }
#agent-native-auth-root .msg.show.error::before { content: "!"; background: var(--tf-danger); }
#agent-native-auth-root .msg.show.success { color: var(--tf-verified); background: color-mix(in srgb, var(--tf-verified) 10%, var(--tf-card)); border: 1px solid color-mix(in srgb, var(--tf-verified) 30%, transparent); }
#agent-native-auth-root .msg.show.success::before { content: "\2713"; background: var(--tf-verified); }
#agent-native-auth-root .google-error.show { color: var(--tf-danger); }
#agent-native-auth-root .verification-panel, #agent-native-auth-root .upgrade-note.show { background: var(--tf-shade); border-color: var(--tf-rule); color: var(--tf-ink); }
#agent-native-auth-root .verification-kicker { color: var(--tf-verified); }
#agent-native-auth-root .verification-copy, #agent-native-auth-root .verification-copy strong { color: var(--tf-ink); }
#agent-native-auth-root .verification-note, #agent-native-auth-root .progress-step { color: var(--tf-muted); }
#agent-native-auth-root .progress-step span { background: var(--tf-card); border-color: var(--tf-rule); color: var(--tf-muted); }
#agent-native-auth-root .progress-step.complete span { background: var(--tf-verified); border-color: var(--tf-verified); color: var(--tf-card); }
#agent-native-auth-root .progress-step.current span { background: var(--tf-ink); border-color: var(--tf-ink); color: var(--tf-card); box-shadow: 0 0 0 4px var(--tf-shade); }
#agent-native-auth-root .progress-step.complete, #agent-native-auth-root .progress-step.current { color: var(--tf-ink); }
.locale-trigger { color: var(--tf-muted); border-radius: 8px; }
.locale-trigger:hover { color: var(--tf-ink); }

/* Password eye: a sibling button laid over the end of its field. */
.tf-eye {
  position: relative; z-index: 1; display: flex; align-items: center; justify-content: center;
  width: 2.75rem; height: 2.75rem; margin: -3.75rem 0 1rem auto; padding: 0;
  background: transparent; border: 0; border-radius: 11px; color: var(--tf-muted); cursor: pointer;
}
.tf-eye:hover { color: var(--tf-ink); }
.tf-eye svg { width: 1.15rem; height: 1.15rem; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tf-hint { display: flex; align-items: center; gap: 0.6rem; margin: -0.6rem 0 1rem; min-height: 1rem; font-size: 0.75rem; color: var(--tf-muted); }
.tf-hint[hidden] { display: none; }
.tf-meter { display: flex; gap: 3px; }
.tf-meter i { width: 1.4rem; height: 4px; border-radius: 2px; background: var(--tf-rule); transition: background 200ms; }
.tf-hint[data-level="1"] .tf-meter i:nth-child(-n+1),
.tf-hint[data-level="2"] .tf-meter i:nth-child(-n+2) { background: var(--tf-amber); }
.tf-hint[data-level="3"] .tf-meter i:nth-child(-n+3),
.tf-hint[data-level="4"] .tf-meter i { background: var(--tf-verified); }
.tf-hint[data-tone="good"] { color: var(--tf-verified); }
.tf-hint[data-tone="warn"] { color: var(--tf-amber); }
.tf-hint[data-tone="bad"] { color: var(--tf-danger); }

/* The story panel. */
.tf-story {
  position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 2.5rem;
  min-height: 100svh; padding: clamp(2rem, 4.5vw, 4rem);
  background:
    radial-gradient(120% 80% at 50% 110%, rgba(69, 212, 191, 0.10), transparent 60%),
    radial-gradient(80% 60% at 50% -20%, rgba(255, 77, 46, 0.12), transparent 60%),
    #0b0b0d;
  color: #f6efe4; font-family: var(--tf-sans);
}
.tf-brand { display: flex; align-items: center; gap: 0.7rem; font: 600 1.05rem/1 var(--tf-sans); letter-spacing: -0.01em; }
.tf-brand svg { width: 1.75rem; height: 1.75rem; }
.tf-copy { max-width: 34rem; }
.tf-eyebrow { font: 500 0.7rem/1 var(--tf-mono); letter-spacing: 0.2em; text-transform: uppercase; color: rgba(246,239,228,0.45); }
.tf-headline {
  margin: 1rem 0 1rem; font: 400 clamp(2.1rem, 3.6vw, 3.25rem)/1.05 var(--tf-serif); letter-spacing: -0.025em;
  background: linear-gradient(180deg, #ffffff 25%, #a8a39b 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.tf-headline em { font-style: italic; color: #ff6a42; -webkit-text-fill-color: #ff6a42; }
.tf-lede { font-size: 1rem; line-height: 1.55; color: rgba(246,239,228,0.68); max-width: 30rem; }
.tf-lede b { color: #f6efe4; font-weight: 500; }
.tf-specimen {
  max-width: 34rem; padding: 1.25rem 1.25rem 1.1rem; border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 40px 80px -40px rgba(0,0,0,0.8);
  animation: tf-rise 700ms 120ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.tf-spec-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; font: 500 0.7rem/1 var(--tf-mono); letter-spacing: 0.14em; text-transform: uppercase; color: rgba(246,239,228,0.55); }
.tf-sample { padding: 0.25rem 0.45rem; border: 1px dashed rgba(214,160,72,0.7); border-radius: 4px; color: #e0b062; letter-spacing: 0.12em; }
.tf-mirror { display: block; width: 100%; height: auto; margin: 0.9rem 0 0.4rem; }
.tf-mirror .tf-gap { transform-box: fill-box; transform-origin: 50% 100%; animation: tf-grow 900ms 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.tf-quotes { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-top: 0.6rem; }
.tf-quote { padding: 0.65rem 0.75rem; border-radius: 10px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.07); }
.tf-quote p { font: 500 0.625rem/1 var(--tf-mono); letter-spacing: 0.16em; text-transform: uppercase; color: rgba(246,239,228,0.45); margin-bottom: 0.45rem; }
.tf-quote q { display: block; font: 400 0.75rem/1.45 var(--tf-mono); color: rgba(246,239,228,0.85); quotes: "\201C" "\201D"; }
.tf-quote.tf-bill { border-color: rgba(255,106,66,0.35); }
.tf-quote.tf-bill mark { background: rgba(255,106,66,0.18); color: #ff8a66; border-radius: 3px; padding: 0 2px; }
.tf-total { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; padding-top: 0.9rem; border-top: 1px dashed rgba(255,255,255,0.12); }
.tf-total strong { font: 400 2.25rem/1 var(--tf-serif); letter-spacing: -0.02em; background: linear-gradient(180deg, #ffffff 25%, #a8a39b 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.tf-total span { font-size: 0.78rem; color: rgba(246,239,228,0.55); text-align: right; }
.tf-foot { font: 400 0.72rem/1.5 var(--tf-mono); color: rgba(246,239,228,0.38); letter-spacing: 0.04em; }

@keyframes tf-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes tf-grow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
@keyframes tf-pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes tf-shake { 0% { opacity: 0; transform: translateX(0); } 25% { opacity: 1; transform: translateX(-5px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } 100% { transform: none; } }
@keyframes tf-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  #agent-native-auth-root *, #agent-native-auth-root *::before, #agent-native-auth-root *::after { animation: none !important; transition: none !important; }
}

/* Phones and narrow windows: a short night header, then the card. */
@media (max-width: 959px) {
  .auth-root { grid-template-columns: minmax(0, 1fr); }
  .auth-root > .tf-story { grid-row: 1; min-height: 0; gap: 1.25rem; padding: 1.5rem 1.25rem 1.75rem; }
  .auth-root > .auth-page { grid-column: 1; grid-row: 2; min-height: 0; padding: 1.5rem 1rem 3rem; justify-content: flex-start; }
  .tf-headline { font-size: 1.9rem; margin: 0.6rem 0 0.5rem; }
  .tf-lede { font-size: 0.9rem; }
  .tf-specimen, .tf-foot { display: none; }
  #agent-native-auth-root .card { margin-top: -2.25rem; padding: 1.75rem 1.25rem 1.5rem; }
  .locale-picker .locale-trigger { color: rgba(246,239,228,0.6); }
}
`;

/** The notch mark: a tally ledger torn along a zigzag. */
const MARK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2" width="18" height="20" rx="2" fill="currentColor" opacity="0.14"/><path d="M3 12 L6 9.5 L9 12 L12 9.5 L15 12 L18 9.5 L21 12" fill="none" stroke="#ff6a42" stroke-width="2" stroke-linejoin="round"/><path d="M7 4v4M11 4v4M15 4v4M7 16v4M11 16v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/**
 * The sample's Cobalt Workspace bills, Nov 2025 to Oct 2026, as billed ÷ agreed
 * (from seed/expected-findings.json): three honest months, a price above the
 * 5% cap from February, seats over the cap from April, July billed twice.
 */
const COBALT_RATIOS = [1, 1, 1, 1.038, 1.038, 1.246, 1.246, 1.246, 2.3, 1.246, 1.246, 1.246];
const MONTH_INITIALS = ["N", "D", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O"];

function mirrorSvg(): string {
  const mid = 70;
  const base = 24;
  const step = 29;
  const width = 16;
  const bars = COBALT_RATIOS.map((ratio, i) => {
    const x = 10 + i * step;
    const billed = base * ratio;
    const gap = billed - base;
    const label = `<text x="${x + width / 2}" y="${mid + base + 18}" text-anchor="middle" fill="rgba(246,239,228,0.38)" font-size="8" font-family="IBM Plex Mono, monospace">${MONTH_INITIALS[i]}</text>`;
    return (
      `<rect x="${x}" y="${mid - 2 - base}" width="${width}" height="${base}" rx="2" fill="rgba(246,239,228,0.78)"/>` +
      (gap > 0
        ? `<rect class="tf-gap" style="animation-delay:${400 + i * 45}ms" x="${x}" y="${(mid - 2 - billed).toFixed(1)}" width="${width}" height="${gap.toFixed(1)}" rx="2" fill="#ff5a36" filter="url(#tf-glow)"/>`
        : "") +
      `<rect x="${x}" y="${mid + 2}" width="${width}" height="${base}" rx="2" fill="rgba(69,212,191,0.32)"/>` +
      label
    );
  }).join("");
  const julyX = 10 + 8 * step + width / 2;
  return (
    `<svg class="tf-mirror" viewBox="0 0 400 118" role="img" aria-label="Cobalt Workspace sample: billed above the contract in 9 of 12 months; July was billed twice.">` +
    `<defs><filter id="tf-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<line x1="0" x2="400" y1="${mid}" y2="${mid}" stroke="rgba(246,239,228,0.18)" stroke-dasharray="2 3"/>` +
    bars +
    `<text x="${julyX}" y="10" text-anchor="middle" fill="#ff8a66" font-size="8" font-family="IBM Plex Mono, monospace">billed twice</text>` +
    `<text x="398" y="${mid - 8}" text-anchor="end" fill="rgba(246,239,228,0.45)" font-size="7" font-family="IBM Plex Mono, monospace">BILLED</text>` +
    `<text x="398" y="${mid + 14}" text-anchor="end" fill="rgba(69,212,191,0.75)" font-size="7" font-family="IBM Plex Mono, monospace">AGREED</text>` +
    `</svg>`
  );
}

const STORY = `<aside class="tf-story" aria-label="About Tallyfoil">
  <div class="tf-brand">${MARK}<span>Tallyfoil</span></div>
  <div class="tf-copy">
    <p class="tf-eyebrow">Vendor bill audit</p>
    <h2 class="tf-headline">The contract capped it at 5%. <em>The bill went up 9%.</em></h2>
    <p class="tf-lede">Tallyfoil reads your contracts and invoices, quotes the exact lines that disagree, and drafts the dispute. <b>The AI reads; code decides the money.</b></p>
  </div>
  <figure class="tf-specimen">
    <figcaption class="tf-spec-head"><span>Cobalt Workspace · 12 bills</span><span class="tf-sample">Sample audit</span></figcaption>
    ${mirrorSvg()}
    <div class="tf-quotes">
      <div class="tf-quote"><p>The contract</p><q>…than 5% over the fees in effect during the immediately preceding term.</q></div>
      <div class="tf-quote tf-bill"><p>The bill</p><q>Business - seats 40 <mark>USD 26.16</mark> USD 1,046.40</q></div>
    </div>
    <div class="tf-total"><strong>$3,180.24</strong><span>recoverable across 2 sample vendors<br/>19 findings, each quoted from both documents</span></div>
  </figure>
  <p class="tf-foot">Every number links back to the line it came from.</p>
</aside>`;

const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.7 3.6M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';

/**
 * Runs after React hydrates the card (it waits for React's fiber key on an
 * input), so nothing it adds can cause a hydration mismatch. React 19 resets
 * an input's `type` on every update, so a per-input observer re-applies the
 * visible state the user chose.
 */
const SCRIPT = `(function () {
  var root = document.getElementById("agent-native-auth-root");
  if (!root) return;
  var EYE = ${JSON.stringify(EYE)}, EYE_OFF = ${JSON.stringify(EYE_OFF)};
  var LABELS = ["", "Okay", "Good", "Strong", "Very strong"];
  var done = new WeakSet(), hinted = new WeakSet();

  function hydrated(el) { return Object.keys(el).some(function (k) { return k.indexOf("__reactFiber") === 0; }); }

  function addEye(input) {
    if (done.has(input)) return;
    done.add(input);
    var shown = false, sel = [null, null];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tf-eye";
    input.setAttribute("data-tf-eye", "");
    function render() {
      btn.innerHTML = shown ? EYE_OFF : EYE;
      btn.setAttribute("aria-label", shown ? "Hide password" : "Show password");
      btn.setAttribute("aria-pressed", String(shown));
      btn.title = shown ? "Hide password" : "Show password";
    }
    function apply() {
      var want = shown ? "text" : "password";
      if (input.type === want) return;
      input.type = want;
      if (document.activeElement === input && sel[0] !== null) { try { input.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
    function remember() { sel = [input.selectionStart, input.selectionEnd]; }
    ["input", "keyup", "select", "click"].forEach(function (t) { input.addEventListener(t, remember); });
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    btn.addEventListener("click", function () { remember(); shown = !shown; render(); apply(); });
    if (input.form) input.form.addEventListener("submit", function () { shown = false; render(); apply(); }, true);
    new MutationObserver(apply).observe(input, { attributes: true, attributeFilter: ["type"] });
    render();
    input.insertAdjacentElement("afterend", btn);
    return btn;
  }

  function addHint(input) {
    var anchor = input.nextElementSibling && input.nextElementSibling.classList.contains("tf-eye") ? input.nextElementSibling : input;
    var hint = document.createElement("p");
    hint.className = "tf-hint";
    hint.hidden = true;
    hint.setAttribute("aria-live", "polite");
    anchor.insertAdjacentElement("afterend", hint);
    return hint;
  }

  function strength(pass, confirm) {
    var meter = addHint(pass);
    meter.innerHTML = '<span class="tf-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="tf-meter-text"></span>';
    var meterText = meter.querySelector(".tf-meter-text");
    var match = confirm ? addHint(confirm) : null;
    function update() {
      var v = pass.value, min = pass.minLength > 0 ? pass.minLength : 8;
      meter.hidden = v.length === 0;
      var level = 0;
      if (v.length >= min) {
        level = 1;
        if (v.length >= min + 4) level++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) level++;
        if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) level++;
      }
      meter.setAttribute("data-level", String(level));
      meter.setAttribute("data-tone", level === 0 ? "warn" : level >= 3 ? "good" : "");
      var left = min - v.length;
      meterText.textContent = level === 0 ? left + " more character" + (left === 1 ? "" : "s") : LABELS[level] + " password";
      if (!match) return;
      var c = confirm.value;
      match.hidden = c.length === 0;
      if (c === v) { match.textContent = "\\u2713 Passwords match"; match.setAttribute("data-tone", "good"); }
      else if (v.indexOf(c) === 0) { match.textContent = "Keep typing\\u2026"; match.setAttribute("data-tone", ""); }
      else { match.textContent = "Passwords don\\u2019t match"; match.setAttribute("data-tone", "bad"); }
    }
    pass.addEventListener("input", update);
    if (confirm) confirm.addEventListener("input", update);
  }

  function busyOnSubmit(form) {
    if (done.has(form)) return;
    done.add(form);
    form.addEventListener("submit", function () {
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      btn.setAttribute("data-tf-busy", "");
      setTimeout(function () { btn.removeAttribute("data-tf-busy"); }, 12000);
    });
    function idle() {
      var b = form.querySelector("button[data-tf-busy]");
      if (b) b.removeAttribute("data-tf-busy");
    }
    // The message node may be created fresh, so watch the whole form for one to show.
    new MutationObserver(function () {
      var msg = form.querySelector(".msg.show");
      if (!msg) return;
      if (!msg.hasAttribute("role")) msg.setAttribute("role", msg.classList.contains("error") ? "alert" : "status");
      idle();
    }).observe(form, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    form.addEventListener("input", idle);
  }

  function scan() {
    var inputs = root.querySelectorAll('input[type="password"]');
    for (var i = 0; i < inputs.length; i++) addEye(inputs[i]);
    var forms = root.querySelectorAll("form");
    for (var j = 0; j < forms.length; j++) busyOnSubmit(forms[j]);
    var pass = document.getElementById("s-pass");
    if (pass && !hinted.has(pass)) { hinted.add(pass); strength(pass, document.getElementById("s-pass2")); }
  }

  var tries = 0;
  (function wait() {
    var probe = root.querySelector("input");
    if ((probe && hydrated(probe)) || tries++ > 120) {
      scan();
      new MutationObserver(scan).observe(root, { childList: true, subtree: true });
    } else {
      setTimeout(wait, 50);
    }
  })();
})();`;

const ENHANCEMENTS = `<style>${STYLES}</style>`;
const TAIL_SCRIPT = `<script>${SCRIPT}</script>`;

/** The sign-in page: framework card + Tallyfoil styling, story panel and password helpers. */
export function renderTallyfoilAuthPage(props: AuthPageProps): string {
  return renderAuthPage(props) + ENHANCEMENTS + STORY + TAIL_SCRIPT + FONTS;
}

/** The reset-password page gets the same card styling and password eye. */
export function renderTallyfoilResetPasswordPage(props: ResetPasswordPageProps): string {
  return renderAuthResetPasswordPage(props) + ENHANCEMENTS + TAIL_SCRIPT + FONTS;
}
