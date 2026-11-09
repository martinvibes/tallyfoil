import type { AuthPageProps, ResetPasswordPageProps } from "@agent-native/core/shared/auth-page-types";
import { renderAuthPage, renderAuthResetPasswordPage } from "@agent-native/toolkit/app/auth/server";

/**
 * Tallyfoil's sign-in and reset cards.
 *
 * The framework renders the auth card and hydrates it with React, so we never
 * touch its markup or props, and the page around the card stays as the
 * framework draws it. We append a stylesheet for the card and a small script
 * after it, inside the root (React leaves trailing root-level nodes alone during
 * hydration). The script adds show/hide toggles to password fields, a live
 * strength and match hint, and a busy state on submit.
 */

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"/>' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter:wght@400..600&display=swap"/>';

/** Card styles only. The page background stays the framework's. */
const STYLES = String.raw`
#agent-native-auth-root {
  --tf-card: #131211;
  --tf-field: #0d0c0b;
  --tf-ink: hsl(40 37% 91%);
  --tf-muted: hsl(38 10% 62%);
  --tf-rule: rgba(246, 239, 228, 0.1);
  --tf-shade: rgba(246, 239, 228, 0.05);
  --tf-notch: hsl(17 84% 52%);
  --tf-on-notch: #fff;
  --tf-verified: hsl(136 30% 58%);
  --tf-amber: hsl(38 70% 60%);
  --tf-danger: hsl(2 80% 68%);
  --tf-serif: "Fraunces", Georgia, serif;
  --tf-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#agent-native-auth-root .card {
  position: relative; max-width: 420px; padding: 2.25rem 2rem 2rem; border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.025), transparent 40%), var(--tf-card);
  border: 1px solid var(--tf-rule); color: var(--tf-ink); font-family: var(--tf-sans);
  box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 90px -30px rgba(0,0,0,0.85);
  -webkit-font-smoothing: antialiased;
  animation: tf-rise 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
#agent-native-auth-root .card::before {
  content: ""; position: absolute; top: 0; left: 2rem; right: 2rem; height: 1px;
  background: linear-gradient(90deg, transparent, var(--tf-notch), transparent); opacity: 0.7;
}
#agent-native-auth-root h1 { font-family: var(--tf-serif); font-weight: 500; font-size: 2rem; line-height: 1.1; letter-spacing: -0.02em; color: var(--tf-ink); margin-bottom: 0.375rem; }
#agent-native-auth-root .subtitle { font-size: 0.9rem; color: var(--tf-muted); margin-bottom: 1.5rem; }
#agent-native-auth-root .tabs { padding: 4px; margin-bottom: 1.5rem; background: var(--tf-shade); border: 1px solid var(--tf-rule); border-radius: 12px; }
#agent-native-auth-root .tab { padding: 0.55rem 0.75rem; border-radius: 9px; color: var(--tf-muted); font-size: 0.85rem; font-weight: 500; transition: background 160ms, color 160ms; }
#agent-native-auth-root .tab.active { background: rgba(246,239,228,0.1); color: var(--tf-ink); box-shadow: 0 1px 2px rgba(0,0,0,0.4); }
#agent-native-auth-root .tab:hover:not(.active) { color: var(--tf-ink); }
#agent-native-auth-root label { font-size: 0.8125rem; font-weight: 500; color: var(--tf-ink); margin-bottom: 0.4rem; }
#agent-native-auth-root input:not([type="checkbox"]):not([type="radio"]) {
  display: block; height: 2.75rem; padding: 0 0.9rem; margin-bottom: 1rem;
  background: var(--tf-field); color: var(--tf-ink); border: 1px solid var(--tf-rule); border-radius: 11px;
  font: 400 0.9375rem/1 var(--tf-sans); transition: border-color 140ms, box-shadow 140ms;
}
#agent-native-auth-root input::placeholder { color: var(--tf-muted); opacity: 0.6; }
#agent-native-auth-root input:hover { border-color: rgba(246,239,228,0.2); }
#agent-native-auth-root input:focus { border-color: var(--tf-notch); box-shadow: 0 0 0 4px color-mix(in srgb, var(--tf-notch) 18%, transparent); }
#agent-native-auth-root input:user-invalid { border-color: var(--tf-danger); }
#agent-native-auth-root input[data-tf-eye] { padding-right: 3rem; }
#agent-native-auth-root button[type="submit"], #agent-native-auth-root .btn-primary {
  position: relative; height: 2.875rem; margin-top: 0.5rem; padding: 0 1rem; border-radius: 11px;
  background: var(--tf-notch); color: var(--tf-on-notch); font: 600 0.9375rem/1 var(--tf-sans); letter-spacing: 0.01em;
  box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 12px 28px -12px color-mix(in srgb, var(--tf-notch) 85%, transparent);
  transition: filter 140ms, transform 80ms;
}
#agent-native-auth-root button[type="submit"]:hover, #agent-native-auth-root .btn-primary:hover { background: var(--tf-notch); filter: brightness(1.1); }
#agent-native-auth-root button[type="submit"]:active, #agent-native-auth-root .btn-primary:active { transform: translateY(1px); }
#agent-native-auth-root button:focus-visible { outline: 2px solid var(--tf-notch); outline-offset: 2px; }
#agent-native-auth-root button[type="submit"]:disabled { opacity: 0.6; }
#agent-native-auth-root button[data-tf-busy] { color: transparent !important; pointer-events: none; }
#agent-native-auth-root button[data-tf-busy]::after {
  content: ""; position: absolute; inset: 0; margin: auto; width: 1.15rem; height: 1.15rem; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; animation: tf-spin 700ms linear infinite;
}
#agent-native-auth-root .btn-secondary, #agent-native-auth-root .btn-google { height: 2.75rem; border-radius: 11px; }
#agent-native-auth-root .link-button { color: var(--tf-muted); }
#agent-native-auth-root .link-button:hover { color: var(--tf-ink); }

/* Errors and success: a real alert, not a line of red text. */
#agent-native-auth-root .msg.show {
  display: flex; gap: 0.6rem; align-items: flex-start; margin-top: 1rem; padding: 0.7rem 0.85rem;
  border-radius: 11px; font-size: 0.85rem; line-height: 1.45; animation: tf-pop 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
#agent-native-auth-root .msg.show::before {
  flex: none; display: grid; place-items: center; width: 1.25rem; height: 1.25rem; border-radius: 50%;
  font: 700 0.75rem/1 var(--tf-sans); color: #111;
}
#agent-native-auth-root .msg.show.error { color: var(--tf-danger); background: color-mix(in srgb, var(--tf-danger) 10%, var(--tf-card)); border: 1px solid color-mix(in srgb, var(--tf-danger) 32%, transparent); animation-name: tf-shake; }
#agent-native-auth-root .msg.show.error::before { content: "!"; background: var(--tf-danger); }
#agent-native-auth-root .msg.show.success { color: var(--tf-verified); background: color-mix(in srgb, var(--tf-verified) 10%, var(--tf-card)); border: 1px solid color-mix(in srgb, var(--tf-verified) 32%, transparent); }
#agent-native-auth-root .msg.show.success::before { content: "\2713"; background: var(--tf-verified); }

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

@keyframes tf-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes tf-pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes tf-shake { 0% { opacity: 0; } 25% { opacity: 1; transform: translateX(-5px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } 100% { transform: none; } }
@keyframes tf-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  #agent-native-auth-root *, #agent-native-auth-root *::before, #agent-native-auth-root *::after { animation: none !important; transition: none !important; }
}
@media (max-width: 480px) {
  #agent-native-auth-root .card { padding: 1.75rem 1.25rem 1.5rem; }
}
`;

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

/** The sign-in page: the framework card with Tallyfoil styling and password helpers. */
export function renderTallyfoilAuthPage(props: AuthPageProps): string {
  return renderAuthPage(props) + ENHANCEMENTS + TAIL_SCRIPT + FONTS;
}

/** The reset-password page gets the same card styling and password eye. */
export function renderTallyfoilResetPasswordPage(props: ResetPasswordPageProps): string {
  return renderAuthResetPasswordPage(props) + ENHANCEMENTS + TAIL_SCRIPT + FONTS;
}
