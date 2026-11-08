# Agent-Native — verified notes (checked against agent-native.com/docs, 6 Nov 2026)

These are the APIs this project relies on. If the installed version disagrees, the
installed types win: check `node_modules/@agent-native/core` and update this file.
Latest release seen: `@agent-native/core@0.224.0` (5 Nov 2026). New apps pin exact versions.

## Scaffold & run
```bash
npx --yes @agent-native/core@latest create tallyfoil --standalone --template chat
cd tallyfoil && corepack enable && pnpm install
pnpm add @electric-sql/pglite@^0.5.8 pdfjs-dist papaparse && pnpm add -D vitest @types/papaparse
echo 'DATABASE_URL=pglite:./data/pglite' >> .env
pnpm dev   # http://localhost:8080 → "Continue as local dev" → connect an LLM
```
Node 22.22+. LLM: "Connect Builder.io" (free credits) or "Custom keys" (Anthropic key).

## Actions
```ts
import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
export default defineAction({
  description: "One line the agent reads to decide when to call this.",
  schema: z.object({ vendorId: z.string().describe("Vendor id") }),
  http: { method: "GET" },          // GET => readOnly, no refresh. Default POST.
  // http: false                    // agent/CLI only (use for view-screen)
  // agentTool: false               // UI-only, hidden from the model
  // needsApproval: true            // agent call pauses for human approval
  // deferLoading: false            // include in the agent's first-turn tool set
  run: async (args) => { /* ... */ },
});
```
- Files in `actions/` are auto-discovered. Filename = action name. Use verb-noun names.
- Fail with `fail(message, { errorCode, statusCode, details })` — not `throw new Error`
  (bare errors become a generic 500 and the agent can't read them). Agent sees
  `errorCode` and `details`, so put the failing item ids in `details`.
- Optional `outputSchema` (zod) validates the return value.
- Results for create/update: return `id`, a one-line `message`, and optionally
  `nextRequiredAction` naming the next tool (e.g. after `record-invoices` → `run-audit`).
- Current user: see the Run Context docs (`ctx`) — use the user's email for `owner_email`.
  Verify the exact field name in the installed types before writing queries.

## Client hooks
```ts
import { useActionQuery, useActionMutation, callAction, actionErrorMessage }
  from "@agent-native/core/client/hooks";
const { data } = useActionQuery("get-vendor", { vendorId }, { enabled: !!vendorId });
const { mutate } = useActionMutation("review-finding", { onSuccess: () => {} });
```
Mutations invalidate action queries automatically. During an agent chat run, each
side-effecting tool call refreshes the current tab's queries — that's how Terms/Findings
fill live while the agent works. No `useDbSync` realtime opt-in needed (single user).

## Agent chat bridge
```ts
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
sendToAgentChat({ message: "Audit Cobalt Workspace", context: "vendorId: v_123",
                  submit: true, openSidebar: true });
```
`message` is visible, `context` is hidden model context. `submit:false` prefills.

## Context awareness
```ts
import { readAppState, writeAppState } from "@agent-native/core/application-state"; // server
import { setClientAppState } from "@agent-native/core/client/hooks";                // browser
import { useAgentRouteState } from "@agent-native/core/client/navigation";
```
- UI writes `navigation` on route change via an app-owned `app/hooks/use-navigation-state.ts`
  wrapping `useAgentRouteState({ browserTabId, requestSource, getNavigationState, getCommandPath })`.
  The template should already ship this file — extend it, don't rewrite.
- UI writes `selection` with `setClientAppState("selection", value, { keepalive: true })`.
- Agent moves the UI with `writeAppState("navigate", {...})` (our `navigate` action).
- `view-screen` (`http: false`) reads `navigation` + `selection` and hydrates records.
- Never let the agent write `navigation` directly.

## Database
- `server/db/schema.ts` (drizzle `pgTable`), `server/db/index.ts`:
  ```ts
  import { createGetDb } from "@agent-native/core/db";
  import * as schema from "./schema.js";
  export const getDb = createGetDb(schema);
  ```
  Import `getDb` from this local file (typed), not from core.
- Migrations: `pnpm db:generate` → `server/db/migrations/*.sql`, loaded by
  `server/db/migrations.ts` with `runDrizzleMigrations(...)` and re-exported from
  `server/plugins/db.ts`. Production: `pnpm migrate:production`.
- Inspect: `pnpm action db-schema`, `pnpm action db-query --sql "..."`.

## Agent resources
- `AGENTS.md` at app root: always loaded. `.agents/skills/<name>/SKILL.md`: on demand.
- Scheduled automation = `jobs/<name>.md` with frontmatter `schedule` (cron), `enabled`.
  Create it through Settings › Automations or by asking the agent ("create a scheduled
  automation…"), or `resourcePut(ownerEmail, "jobs/renewal-watch.md", text)` from
  `@agent-native/core/resources`. Locally it won't tick unless enabled; use **Run now**.
  On Vercel production it needs `CRON_SECRET` (Hobby: max once a day — fine for us).

## MCP (stretch demo)
Every app auto-mounts `/mcp`. From Claude Code:
`claude mcp add --transport http tallyfoil https://<your-app>/mcp` → `/mcp` → Authenticate.

## Edit conflicts (stretch)
Release 0.224.0 added `saveIfCurrent` in `@agent-native/core/save-conflict/server`
(writes only if the record still has the revision the caller read; otherwise throws a typed
`save_conflict` with the current value) and `saveWithMerge` in
`@agent-native/core/save-conflict`. Confirm the exact signature in node_modules before
using it in `update-term`. If it's awkward, keep our own `revision` check + `fail()` with
`errorCode: "save_conflict"`.

## File uploads
Framework upload storage needs a provider (Builder.io or S3) and never stores binaries in
SQL. **We don't need it**: extract text in the browser and send text to `add-document`.

## Deploy (Vercel or Netlify + Neon)
Env: `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` (stable), `BETTER_AUTH_URL` (public URL),
LLM key or Builder connection, `CRON_SECRET` (Vercel) / `A2A_SECRET` (Netlify) for
scheduled automations. Run `pnpm migrate:production` before first visit. Follow the host
guide at agent-native.com/docs/vercel or /netlify for the `NITRO_PRESET` build.
Set a spend limit on the LLM key — judges will run the agent.
