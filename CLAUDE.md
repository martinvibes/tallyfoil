# Tallyfoil — Claude Code project instructions

Tallyfoil is an Agent-Native app that audits vendor bills against what was agreed,
proves every overcharge with quotes from both documents, and drafts the dispute.
It is our entry for the Builder.io **Agent-Native Hackathon**. Deadline:
**Mon 9 Nov 2026, 11:59 PM PT** (= Tue 10 Nov, 08:59 Lagos). We submit Mon evening Lagos time.

Read these before writing code, in this order:
1. `docs/SPEC.md` — what we're building, data model, every action
2. `docs/ENGINE.md` — audit rules and the evidence check (deterministic code)
3. `docs/FRAMEWORK_NOTES.md` — verified Agent-Native APIs (do not guess APIs)
4. `docs/UI.md` — screens and visual design
5. `app/seed/expected-findings.json` — the numbers the engine must reproduce

## Repo layout
The app lives in **`app/`**. Every code path in the docs (`actions/`, `server/audit/`,
`server/db/`, `seed/`) is relative to `app/`. The in-app agent's instructions are
`app/AGENTS.md` (the template's framework sections plus ours), and its skills are in
`app/.agents/skills/` (`audit-vendor`, `learn-from-rejection`, `write-dispute`).

## The one-sentence thesis
**The AI reads; code decides the money.** The agent extracts terms and bill lines
from messy documents, but every value it records must be backed by a quote that
exists in the source, and every dollar figure is computed by deterministic code.
Judges should be able to click any number and see where it came from.

## Hard rules (break these and we lose points)

1. **Every capability is a `defineAction()` in `actions/`.** The UI calls it with
   `useActionQuery` / `useActionMutation`; the agent calls the same action as a tool.
   No separate REST routes for app features.
2. **No inline LLM calls anywhere.** All AI work goes through the in-app agent
   (framework rule). UI buttons that need AI call `sendToAgentChat()`.
3. **The agent never writes a dollar amount into the database.** Amounts come only
   from `server/audit/engine.ts`. Dispute prose is checked by the number guard
   (`docs/ENGINE.md` §5).
4. **Every extracted value carries evidence** (`documentId` + 1–3 quote fragments).
   `record-terms` and `record-invoices` reject values whose quotes are not found in the
   document text, or whose value does not appear in the quote. Fail with `fail()` and a
   clear `errorCode` so the agent retries.
5. **Money is integer cents; token counts are integers; rates are stored as
   integer micro-dollars per unit** (see ENGINE.md). Never use floats for money.
6. **All state in PostgreSQL via Drizzle** (`server/db/schema.ts`). PGlite locally,
   Neon in production. Every user table has `owner_email`; every query filters by it.
7. **Four-area checklist for every feature:** UI + action + AGENTS.md/skill + app-state
   (`navigation`, `selection`, `view-screen`).
8. **Sample data is labeled.** Sample documents say "SAMPLE DOCUMENT" and the UI shows a
   "Sample data" badge on sample vendors. Never present sample findings as real.
9. Keep the agent tool surface small (~20 actions). Mark UI-only actions `agentTool: false`.
10. Don't edit generated framework files; build on the Chat template's structure.

## Stack
- Scaffold: `npx --yes @agent-native/core@latest create tallyfoil --standalone --template chat`
- React + React Router (from template), Tailwind v4 (from template), Drizzle, zod
- PDF text: `pdfjs-dist` **in the browser** (we send text, never binaries, to actions)
- CSV: `papaparse` in the browser, deterministic parse on the server too
- Tests: `vitest` for the audit engine and evidence matcher

## Definition of done (per feature)
- Action exists, typed, with `.describe()` on every field and a one-line description
- UI uses the same action; agent can do the same thing from chat
- `view-screen` returns data for the new view/selection
- AGENTS.md or a skill documents when the agent should use it
- Engine changes: `pnpm test` passes and still reproduces `seed/expected-findings.json`

## Commands
- `pnpm dev` — app at http://localhost:8080 (sign in: "Continue as local dev")
- `pnpm test` — engine + matcher tests
- `pnpm action <name> --arg=value` — call any action from the terminal
- `pnpm action db-query --sql "select * from findings"` — inspect data
- `pnpm db:generate` — generate migration after schema change

## When unsure about a framework API
Check `node_modules/@agent-native/core` types or https://www.agent-native.com/docs/
before inventing anything. Note what you verified in `docs/FRAMEWORK_NOTES.md`.

## Working style
- Commit and push each small, working step.
- If something blocks you for more than ~30 minutes, cut it and move on; tell me what you cut.
- Prefer boring, reliable code. The demo must never crash on camera.
