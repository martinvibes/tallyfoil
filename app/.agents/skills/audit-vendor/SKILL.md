---
name: audit-vendor
description: Read a vendor's contract, invoices and usage exports, record every term and bill line with exact quotes, then run the audit and report results. Use when new documents are added or the user asks to audit or check a vendor's bills.
---

# Audit a vendor

## Steps
1. `get-vendor` → see documents and their status. Work only on documents with status
   `new` or `read` unless the user asks for a full re-read.
2. **Usage exports first** (kind `usage_export`): call `ingest-usage-export` for each.
   It is deterministic; don't read the CSV yourself.
3. **Contract / order form / amendments**: `read-document` with its id, then one
   `record-terms` call `{documentId, terms: [{key, value, quotes}]}` with every term found.
   - Seat subscriptions: seat_price, seat_cap, renewal_uplift_cap_bps, term_start,
     term_end, auto_renew, notice_days.
   - Usage-metered: one `meter_rate` per model × direction (with `meter`, e.g.
     "halcyon-small input"); billing_basis "usage_export" if usage is billed from the export.
   - Amendments or agreed changes that start later: set `effectiveFrom`.
4. **Invoices**: `read-document` with up to 6 `documentIds` at once, then one
   `record-invoices` call for that batch. Each invoice: `documentId`, `invoiceNumber`,
   `invoiceDate`, `periodStart`, `periodEnd` (ISO), `total`, `totalQuotes`,
   `periodQuotes`, and every line `{description, quantity, unitPrice, amount, quotes}`
   (+ `meter` for usage lines, `kind: "other"` for tax/fees/credits).
   Token quantities shown in millions → give the full integer (412 → 412000000) and quote
   the row as printed.
5. If a record action fails, read `details.failed` and resend only those items, fixed.
   Never drop a failed item silently — tell the user if you can't ground it.
6. `run-audit` for the vendor.
7. Report: total recoverable, at-risk amount and its deadline, and the top 3 findings by
   amount in plain words, using amounts exactly as returned. Mention any `verify` findings
   and ask the one question that would settle them (e.g. "Did you approve going from 40 to
   48 seats?").
8. `navigate` to the vendor workspace.

## Quoting tips
- Copy fragments exactly as `read-document` shows them, minus the "12 | " prefix.
- Prefer short, unique fragments: "USD 24.00 per seat per month", "Total Due: USD 1,255.68".
- A table row is the best quote for a line: it shows quantity, unit price and amount together.
- Dates: quote them as written ("January 31, 2026"); pass the value as ISO.
