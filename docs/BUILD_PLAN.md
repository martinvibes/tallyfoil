# Build plan — Fri 6 Nov → Mon 9 Nov (Lagos time, WAT)

Hard deadline: **Tue 10 Nov 08:59 WAT** (Mon 9 Nov 11:59 PM PT).
Our target: **submitted by Mon 9 Nov 20:00 WAT.** Don't touch features after Mon 14:00.

Order is chosen so that if we run out of time, what exists is still a complete demo.
Commit at every checkpoint.

## Phase 0 — Scaffold (Fri, ~1h)
- Create the app in `app/` per FRAMEWORK_NOTES.md, PGlite, LLM connected, hello action
  works from chat.
- Merge `app-agent/AGENTS.md` into `app/AGENTS.md`; skills → `app/.agents/skills/`.
- Copy `seed/` to `app/seed/` (`sample-documents.json`, `sample-structured.json`,
  `expected-findings.json`, `sample-docs/*`).
- ✅ Checkpoint: app runs; agent answers; repo pushed to GitHub (public is fine).

## Phase 1 — Engine first (Fri, ~4h)
- `server/audit/money.ts`, `evidence.ts`, `usage.ts`, `engine.ts`, `number-guard.ts` + tests.
- Golden test from ENGINE.md passes against `seed/sample-structured.json`.
- ✅ Checkpoint: `pnpm test` green; engine reproduces $3,180.24 / $1,769.04 / $15,068.16.

## Phase 2 — Data + ingestion + grounded recording (Fri night → Sat midday, ~5h)
- Schema + migrations for every table in SPEC.md §6.
- Actions: `create-vendor`, `add-document`, `ingest-usage-export`, `read-document`,
  `record-terms`, `record-invoices`, `run-audit`, `get-overview`, `get-vendor`,
  `get-finding`, `load-sample-data`, `reset-demo`.
- Run the agent on the sample set from chat. Fix the skill text until it records every
  term and invoice with valid evidence on the first or second try.
- ✅ Checkpoint: from chat, "Audit both sample vendors" ends with the expected totals.

## Phase 3 — The workspace UI (Sat, ~6h)
- Home, Vendor workspace, Evidence view, Document view (UI.md). Visual identity applied.
- Navigation + selection app-state, `view-screen`, `navigate`.
- Upload flow with pdfjs extraction.
- ✅ Checkpoint: click a finding → both halves highlighted + math strip; "Ask why" works.

## Phase 4 — Human steering (Sat night → Sun morning, ~4h)
- `review-finding`, `add-vendor-rule`, `remove-vendor-rule`, `update-term`.
- Reject-with-reason → `sendToAgentChat` → agent adds rule → audit re-runs → total
  animates from $3,180.24 to $1,769.04 on the sample.
- ✅ Checkpoint: the full steering beat works 3 times in a row from a fresh reset.

## Phase 5 — Disputes + automation (Sun, ~4h)
- `draft-dispute`, `update-dispute`, `approve-dispute` (needsApproval), number guard,
  composer screen, mailto/copy.
- Renewal-watch scheduled automation (app-agent/jobs/renewal-watch.md); "Run now" works.
- ✅ Checkpoint: dispute for Cobalt with evidence table; agent tries to type a made-up
  number → guard rejects → agent rewrites.

## Phase 6 — Deploy + real data (Sun evening, ~3h)
- Neon + Vercel (or Netlify). Migrations. Env vars. LLM spend limit.
- Run Tallyfoil on at least one **real** bill (ours or a friend's) + its pricing page /
  order form. Keep whatever it honestly finds, even $0, for the demo ending.
- ✅ Checkpoint: production URL works for a brand-new account end to end.

## Phase 7 — Polish + stretch (Mon until 14:00)
Only in this order, only if time: loading/empty/error states → mobile tabs → MCP beat
(`claude mcp add …`, ask "what's my recoverable total?") → `saveIfCurrent` conflict on terms.

## Phase 8 — Record + submit (Mon 14:00–20:00)
- Rehearse DEMO_SCRIPT.md twice. Record with Clips (public link, no login). Check it in
  an incognito window.
- Submit the form (SUBMISSION.md). Confirm receipt email/screen. Screenshot it.

## Cut lines (take them without debate if behind)
| If behind at… | Cut |
|---|---|
| Sat 12:00 (Phase 2 not done) | Drop Halcyon/AI mode from the live demo; keep engine support |
| Sun 08:00 (Phase 4 not done) | Drop `update-term` editing; keep reject→rule beat only |
| Sun 18:00 (Phase 5 not done) | Drop the automation; mention deadline finding only |
| Mon 12:00 | Drop all stretch; freeze; record |
Never cut: grounded evidence, engine-computed amounts, evidence view, reject→rule beat,
dispute draft. Those are the scoring core.
