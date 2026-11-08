# Tallyfoil — UI & visual design

Creativity & Design is 20% of the score. The look must be distinctive and the evidence
view must be the moment people remember. Avoid a generic dashboard template look.

## Visual identity: "the ledger and the notch"
- **Mood:** an old treasury ledger made precise. Warm paper, black ink, one sharp accent.
- **Colors (CSS tokens, light):** paper `#F6F1E7`, panel `#FFFDF8`, ink `#1C1A17`,
  muted ink `#6B645A`, rule lines `#E2D9C8`, **notch red** `#C2410C` (overcharges,
  primary actions), **verified green** `#3F6B4A` (accepted, matches), **amber** `#B7791F`
  (verify / deadlines). Dark mode: ink `#EDE6D8` on `#16140F`, panel `#1F1C16`; same accents
  slightly lighter.
- **Type:** money and headings in a serif with good numerals (`Fraunces` or
  `Instrument Serif` from Google Fonts); body in `Inter`; quotes, ids and figures in
  `IBM Plex Mono`. Use tabular figures for every amount.
- **Signature shape:** the *foil edge*, a zigzag notch line (CSS `clip-path` or an SVG)
  used as the divider between the two halves of the evidence view, and as the logo
  mark (a stick split by a notched line).
- **Motion:** the Recoverable total counts up/down over ~600ms when it changes. Findings
  slide in as they're created. Nothing else animates.

## Layout
Agent chat lives in the framework `AgentSidebar` on the right (collapsible). Main area:

### 1. Home (`/`)
- Hero strip: **Recoverable $X** (huge serif numerals, notch red) · **At risk $Y**
  (amber, with the nearest deadline: "Notice due 2 Dec") · findings count by status.
- Vendor cards: name, kind badge (Seats / Usage), "Sample data" badge when `is_sample`,
  recoverable for that vendor, open findings count, last audited time.
- Empty state: two buttons, **Load sample audit** (calls `load-sample-data`, then
  `sendToAgentChat({message: "Audit both sample vendors", submit: true})`) and
  **Upload your bills** (drop zone).

### 2. Vendor workspace (`/vendors/:vendorId`)
Three columns on desktop, tabs on mobile.
- **Left — "Your half"**: Terms table (key, value, effective dates, source badge
  `agent`/`you`/`rule`, evidence chip). Inline-editable values → `update-term`.
  Below: **Rules** list (reason text in quotes, created by, remove button). Below:
  **Documents** list with status (new / read / recorded).
- **Center — Findings**: grouped by severity (Breach, Verify, Deadline), then one
  collapsible group per check ("Renewal price above the 5% cap — 9 months — $345.60")
  with a row per period inside. The sample has 19 findings in 5 groups; never show 19
  flat rows. Each row: period, amount (mono, right aligned), status chip.
  Accept/Reject work on a single row or the whole group. Hover shows the one-line
  explanation. Buttons: Accept ✓, Reject ✕ (opens a reason box: "Why is this OK?").
  Header: vendor total + **Draft dispute** button.
- **Right — Evidence** for the selected finding (see below).

### 3. Evidence view (the hero component)
Two stacked panels separated by the notched foil edge:
- **Their half (the bill)**: document name, the invoice text around the quote with the
  fragment highlighted in notch red.
- **Your half (contract / usage)**: the contract or usage-export text with the
  matching fragment highlighted in green.
- Between them, a **math strip**: `$26.16 billed − $25.20 allowed = $0.96 × 40 seats
  = $38.40`, each number clickable to scroll to its highlight.
- "Ask why" button → `sendToAgentChat({ message: "Explain this finding", context: <finding id + math>, submit: true })`.
- Clicking a finding writes `selection` = `{kind:"finding", findingId, …}`.

### 4. Document view (`/documents/:documentId`)
Full text with line numbers; all evidence highlights from any term/line/finding;
selecting text writes `selection` `{kind:"document-range", start, end}` so
"record this as the notice period" works from chat.

### 5. Dispute composer (`/disputes/:disputeId`)
Subject + intro + closing are editable text; the evidence table and total render
read-only below (code-generated, with a lock icon and the caption "Amounts are
computed from your documents"). Buttons: **Approve**, **Copy email**, **Open in mail**
(`mailto:`). Number-guard errors show inline on the offending text.

## Live behavior during an agent run
- Terms and bill rows appear as the agent records them (framework refreshes queries after
  each tool call). Show a subtle "Agent is reading cobalt-invoice-INV-1036.pdf" status
  pill in the vendor header using document `status`.
- After `run-audit`, the total animates; a toast shows the delta ("+$1,255.68 duplicate
  found").

## Upload flow
Drop zone accepts PDF, TXT, MD, CSV, or paste. In the browser:
- PDF → `pdfjs-dist`: for each page, group `textContent.items` by rounded `transform[5]`
  (y), sort each group by x, join with spaces (keeps table rows on one line), pages
  separated by `\n\n--- page N ---\n\n`. Set `GlobalWorkerOptions.workerSrc` for Vite
  (`pdfjs-dist/build/pdf.worker.min.mjs?url`).
- CSV/TXT/MD → read as text.
- Ask "Which vendor?" (existing or new + kind) and document kind (auto-guess from name).
- Call `add-document` per file, then `sendToAgentChat({ message: "Read and audit the new documents for <vendor>", submit: true })`.

## Accessibility & polish
Contrast ≥ 4.5:1 on paper; focus rings in notch red; all amounts have
`aria-label="1,255 dollars 68 cents"`; works at 390px width (tabs instead of columns).
