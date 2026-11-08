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
3. **Contract / order form / amendments**: `read-document`, then one `record-terms` call
   with every term you found. For each term give the value and 1–3 exact fragments.
   - Seat subscriptions: seat_price, seat_cap, renewal_uplift_cap_bps, term_start,
     term_end, auto_renew, notice_days.
   - Usage-metered: one `meter_rate` per model × direction; billing_basis if stated.
   - Amendments override earlier terms: set `effectiveFrom`.
4. **Invoices**: `read-document` each, then batch them into `record-invoices` calls of up
   to 5 invoices. For each invoice: number, invoice date, period start/end, total, and
   every line (description, meter if metered, quantity, unit price, amount), each with
   fragments. Token quantities shown "in M" → give the full integer (412 M → 412000000)
   and quote the "412" fragment; the matcher understands "(M)".
5. If a record action fails, read `details` and fix only the listed items. Never drop a
   failed item silently — tell the user if you can't ground it.
6. `run-audit` for the vendor.
7. Report: total recoverable, at-risk amount and its deadline, and the top 3 findings by
   amount in plain words. Mention any `verify` findings and ask the one question that
   would settle them (e.g. "Did you approve going from 40 to 48 seats?").
8. `navigate` to the vendor workspace.

## Quoting tips
- Copy fragments exactly as `read-document` shows them, minus the line-number prefix.
- Prefer short, unique fragments: "USD 24.00 per seat per month", "Total Due: USD 1,255.68".
- Table rows split across lines? Use two fragments: the description and the amount.
- Dates: quote them as written ("January 31, 2026"); pass the value as ISO.
