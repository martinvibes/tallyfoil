# Demo script — public Clips recording, target 3:00 (hard max 4:00)

Record at https://clips.agent-native.com/ (screen + camera optional + mic). The recording
must be **public, viewable without login**. Check the link in an incognito window.
Speed up long agent waits in the edit if Clips allows trimming; otherwise pre-run the
extraction and show the replay of the chat (say so honestly: "I ran the reading step a
minute ago; here's what it did").

Before recording: fresh account or `reset-demo`, browser zoom 110%, close other tabs,
agent sidebar open, sample not yet loaded. Have your own real bill ready in a folder.

---

**0:00 — The hook (15s)** · Home screen, empty.
> "Nobody checks every vendor bill against the contract. So charges creep up for months.
> Tallyfoil does. The AI reads your documents; code decides the money; and every
> number can prove where it came from."

**0:15 — The agent has a real job (40s)** · Click **Load sample audit**.
> "This is a labeled sample: a SaaS vendor with a year of invoices, and an AI vendor with
> an October bill and its usage export."
Show the chat: the agent reads the order form, records terms; the Terms table fills live
with evidence chips. Point at one chip.
> "Every value it records has to be an exact quote. If the quote isn't in the
> document, the action rejects it, and the agent has to try again."

**0:55 — The number (20s)** · Audit finishes. Total counts up to **$3,180.24**.
At risk **$15,068.16 — notice due 2 Dec**.
> "Five kinds of problem across 19 bill lines, $3,180 flagged, and a renewal that locks in another $15,000 if nobody
> gives notice by December 2nd."

**1:15 — Proof (35s)** · Open Cobalt → click "Renewal price above the 5% cap".
Evidence view: bill half (USD 26.16) in red, contract half ("no more than 5%") in green,
math strip `26.16 − 25.20 = 0.96 × 40 seats`.
> "Their half, your half. The notch is where they don't match. Every amount is clickable
> back to the line it came from." Click **Ask why** → agent explains in one sentence.

**1:50 — You steer (40s)** · Click "Billed 48 seats; license allows 40" (severity *Verify*).
Reject → type: *"We approved 48 seats by email on 28 March."*
Agent: adds rule "seat cap 48 from April 2026", re-runs. Total animates
**$3,180.24 → $1,769.04**. Seat finding shows *Explained by rule*; price-cap finding grows.
> "It didn't just hide the finding. It learned a rule for this vendor, re-ran the audit,
> and the price check now covers all 48 seats. That's the agent and me working on the
> same data."

**2:30 — Get the money back (25s)** · Click **Draft dispute**.
Agent writes the prose; the evidence table and total are locked.
> "The agent writes the words. It's not allowed to type numbers. If it does, the
> number guard rejects the draft." Show Approve → Copy email.

**2:55 — Real bill (20s)** · Upload your own real invoice + pricing page.
> "And here's my own bill, not a sample." Show whatever it honestly finds, even "no
> issues, prices match the contract."

**3:15 — Close (10s)**
> "Tallyfoil: your half of every deal, checked against every bill. Built on Agent-Native
> — one set of actions powers the UI, the agent, and MCP." (Optional 5s: Claude Code
> calling `get-overview` over MCP.)

---

## Backup plan if something breaks live
- Agent slow → trim the recording; never fake output.
- Model mis-records a value → that's fine on camera: show the action rejecting it and the
  agent fixing it. It proves the evidence check is real.
- Deploy down → record against localhost; the public URL is optional for the rules.
