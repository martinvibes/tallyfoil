# Tallyfoil app

The Agent-Native app behind [Tallyfoil](../README.md). Scaffolded from the Agent-Native
Chat template; see the root README for what it does and how it's built.

```bash
pnpm install
pnpm dev            # http://localhost:8080
pnpm test           # engine, evidence matcher, number guard
pnpm replay-sample  # load and audit the sample set without a model
```

- `actions/` — every capability, shared by the UI and the agent
- `server/audit/` — the deterministic audit engine, evidence matcher and number guard
- `server/tally/` — persistence, views and dispute composition
- `app/components/tally/` — the UI
- `.agents/skills/` — how the in-app agent audits, learns from rejections and drafts disputes
