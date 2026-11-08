# Paste this into Claude Code as your first message

Open Claude Code in an empty folder that contains this build pack (`CLAUDE.md`, `docs/`,
`seed/`, `app-agent/`). Then paste:

---

We're building **Tallyfoil** for the Builder.io Agent-Native Hackathon (deadline Mon 9 Nov
11:59 PM PT). Everything you need is in this folder. Read `CLAUDE.md`, then every file in
`docs/`, then look at `seed/expected-findings.json` and `app-agent/`.

Then do Phase 0 and Phase 1 of `docs/BUILD_PLAN.md`:
1. Scaffold the app with the Chat template **inside a subfolder `app/`** (keep this pack at
   the repo root), install deps, set up PGlite, and confirm `pnpm dev` runs.
2. Merge `app-agent/AGENTS.md` into the template's `app/AGENTS.md`, copy the skills to
   `app/.agents/skills/`, and copy `seed/` to `app/seed/`.
3. Before writing the engine, open the installed `@agent-native/core` types and confirm the
   APIs in `docs/FRAMEWORK_NOTES.md` (defineAction options, fail, client hooks,
   application-state, createGetDb, how an action reads the current user's email). Fix the
   notes file where reality differs.
4. Build `server/audit/` (money, evidence matcher, usage parser, engine, number guard) with
   vitest tests. The golden test must reproduce `seed/expected-findings.json` exactly from
   `seed/sample-structured.json`.

Stop when `pnpm test` is green and show me: the test output, the folder tree, and any
place where the framework differed from the notes. Don't start the UI yet.

Rules: money in integer cents, no floats; no inline LLM calls; every feature is a
`defineAction`; commit after each step.

---

## Next prompts (one per phase)
- **Phase 2:** "Do Phase 2 of BUILD_PLAN.md. When the actions exist, run the agent on the
  sample from chat yourself via `pnpm action` calls where possible, and tune
  `.agents/skills/audit-vendor/SKILL.md` until recording succeeds. Show me the totals."
- **Phase 3:** "Do Phase 3. Follow docs/UI.md closely — the visual identity matters
  (20% of the score). Load the frontend-design guidance if you have it. Show me
  screenshots of Home, Vendor workspace and the Evidence view."
- **Phase 4:** "Do Phase 4. Then run the reject→rule beat three times from `reset-demo`
  and confirm $3,180.24 → $1,769.04 each time."
- **Phase 5:** "Do Phase 5. Prove the number guard by asking the agent to put '$5,000' in
  the intro."
- **Phase 6:** "Deploy to Vercel + Neon following docs/FRAMEWORK_NOTES.md (Deploy) and the
  Vercel guide. Give me the env vars I need to set, then verify a new account end to end."
- **Phase 7:** "Polish in the order listed in Phase 7. Stop at 14:00 WAT Monday."
