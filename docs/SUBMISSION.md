# Submission checklist (form: https://www.builder.io/hackathon/submit)

Deadline: **Mon 9 Nov 2026, 11:59 PM PT = Tue 10 Nov, 08:59 WAT.** Submit Mon evening WAT.
Recording a clip does **not** submit. Technical problems don't extend the deadline.

## Before submitting
- [ ] Clips recording is public; opens in an incognito window without login
- [ ] Production URL works for a brand-new account (sign up → load sample → audit)
- [ ] GitHub repo public, README has: what it is, screenshot/GIF, how to run, architecture
      diagram (actions ↔ UI ↔ agent ↔ engine), "pre-existing work" section
- [ ] LLM key has a spend limit
- [ ] Sample vendors visibly labeled "Sample data"

## Form fields
- **First / last name, email**
- **Project name:** Tallyfoil
- **Project or GitHub URL:** repo URL (and live URL in the description)
- **Public Clips recording URL**
- **Slides URL:** optional — skip unless time remains
- **Agree to rules**, confirm eligibility

## Project description (draft — edit the real-bill line after testing)
> **Tallyfoil finds what your vendors overcharged you, proves it, and drafts the email to
> get it back.**
>
> Upload a vendor's contract and invoices (and the usage export for AI/API vendors). The
> Tallyfoil agent reads every document and records each term and bill line, but every
> value must come with an exact quote that the app verifies against the source text.
> Then a deterministic audit engine (not the model) computes every finding: price above
> the renewal cap, seats beyond the license, duplicate invoices, tokens billed above
> what was logged, rates above contract, and renewal notice deadlines.
>
> Click any amount to see the two halves of the deal: the bill line and the contract
> clause, highlighted, with the arithmetic. Reject a finding with a reason ("we approved
> 48 seats by email") and the agent turns it into a vendor rule, re-runs the audit and
> the totals update live. Disputes are drafted by the agent, but a number guard stops it
> from writing any amount the engine didn't compute; sending requires your approval.
>
> **Agent-Native usage:** ~20 shared `defineAction`s power the UI, the in-app agent and
> the auto-mounted MCP server; `navigation`/`selection` app-state + `view-screen` let the
> agent act on "this finding"; `sendToAgentChat` hands UI intent (Ask why, Reject with
> reason) to the agent; `needsApproval` gates dispute approval; a scheduled automation
> watches renewal deadlines; skills encode the audit, rule-learning and dispute workflows.
>
> **Sample data:** the demo uses a clearly labeled fictional sample set (a SaaS vendor and
> an AI vendor) with known errors, so the totals can be verified by hand. The recording
> ends with a real bill of mine.
>
> **Pre-existing work:** built in two days during the hackathon (8–9 Nov 2026) on the Agent-Native
> Chat template (`@agent-native/core` 0.226.0). Libraries: Drizzle, zod, pdfjs-dist,
> papaparse, vitest, Tailwind. No code from earlier projects.
>
> Team: Martin Chinedu Machiebe (solo, Cypher Labs).

## After submitting
- [ ] Screenshot the confirmation
- [ ] Post on X tagging @builderio with the Clips link (optional, doesn't affect score)
