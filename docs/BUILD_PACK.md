# Tallyfoil — build pack for Claude Code

Everything Claude Code needs to build Tallyfoil for the Builder.io Agent-Native Hackathon.

**Tallyfoil finds what your vendors overcharged you, proves it, and drafts the email to
get it back.** The AI reads; code decides the money.

## How to use this
1. Create an empty repo folder, unzip this pack into it.
2. Open Claude Code there and paste the prompt from `KICKOFF_PROMPT.md`.
3. Feed it one phase at a time (prompts at the bottom of `KICKOFF_PROMPT.md`).
   Review each checkpoint before saying go.

## What's inside
| File | For |
|---|---|
| `CLAUDE.md` | Project rules Claude Code reads every session |
| `KICKOFF_PROMPT.md` | First prompt + one prompt per phase |
| `docs/SPEC.md` | Product, data model, all actions, app-state |
| `docs/ENGINE.md` | Audit checks, evidence matcher, number guard, golden tests |
| `docs/FRAMEWORK_NOTES.md` | Agent-Native APIs verified from the docs (6 Nov) |
| `docs/UI.md` | Screens, visual identity, evidence view |
| `docs/BUILD_PLAN.md` | Phases with WAT checkpoints and cut lines |
| `docs/DEMO_SCRIPT.md` | 3-minute Clips script, beat by beat |
| `docs/SUBMISSION.md` | Form fields, description draft, checklist |
| `app-agent/` | In-app agent instructions, 3 skills, renewal-watch automation |
| `seed/` | Sample PDFs + CSV, extracted text, ground truth, expected findings, generator |

## The sample set (fictional, labeled)
- **Cobalt Workspace** (SaaS seats): order form + 13 monthly invoices (Nov 2025–Oct 2026).
  Planted: renewal price 9% above the 5% cap, 48 seats billed vs a 40-seat license,
  July billed twice, auto-renew notice due 2 Dec 2026.
- **Halcyon AI** (API usage): order form, October invoice, usage export CSV.
  Planted: 23M input tokens billed above the export, a rate above contract.

| Scenario | Recoverable | At risk |
|---|---|---|
| Before any human input | **$3,180.24** | $15,068.16 (notice due 2 Dec 2026) |
| After "we approved 48 seats from April" | **$1,769.04** | $15,068.16 |

Regenerate everything with `python3 seed/generate_samples.py` (needs `reportlab` and
`pdftotext`).

## Key dates
- Deadline: **Tue 10 Nov 08:59 WAT** (Mon 9 Nov 11:59 PM PT)
- Our submit target: **Mon 9 Nov 20:00 WAT**
