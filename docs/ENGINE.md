# Audit engine, evidence matcher, number guard

Everything in this file is **deterministic TypeScript with unit tests**. No AI.
Location: `server/audit/` (engine, matcher, guard, money helpers) + `server/audit/*.test.ts`.

## 1. Units
| Thing | Storage | Example |
|---|---|---|
| Money | integer cents | `$1,255.68` → `125568` |
| Seat price | integer micros (1e-6 USD) per seat-month | `$26.16` → `26160000` |
| Token rate | integer micros per 1M tokens | `$0.25 / 1M` → `250000` |
| Tokens | integer | `900000000` |
| Percent caps | basis points | `5%` → `500` |

Helpers in `server/audit/money.ts`: `parseUsd("USD 1,255.68") → 125568`,
`usdToMicros("26.16") → 26160000`, `centsFromMicros(m)` with round-half-up,
`formatUsd(cents)`. Use `BigInt` for `tokens × micros` products.

## 2. Evidence matcher (`server/audit/evidence.ts`)
Input: document text, fragments `[{quote}]`, and the claimed value.
1. Build a normalized copy of the text: lowercase, curly quotes → straight, all
   whitespace runs → single space, strip `$` spacing differences. Keep an index map
   from normalized offsets back to original offsets.
2. Each fragment must be found (normalized substring). Record original `start/end`.
   Not found → `evidence_not_found` with the fragment.
3. The claimed value must appear in at least one fragment, by type:
   - money: any of `1,255.68`, `1255.68`, `1,255.68` after removing `USD`/`$`
   - integer: digits with or without thousands separators (`412`, `412000000`,
     and `412` when the line is labelled "(M)" — accept `quantity / 1_000_000`
     when the fragment or document header contains `(M)` or `million`)
   - percent: `5%` / `5 %` / `five percent`
   - date: ISO `2026-07-01`, or `July 1, 2026`, `February 1, 2025`, `January 31, 2026`
   Missing → `value_not_in_quote`.
4. 1–3 fragments allowed per value (PDF text often splits a table row).

Tests (`evidence.test.ts`): exact match, whitespace differences, split row with two
fragments, wrong number in quote, quote not in doc, "(M)" token counts.

## 3. Engine (`server/audit/engine.ts`)
```ts
export const ENGINE_VERSION = "1.0.0";
export function audit(input: AuditInput, asOf: string /* ISO date */): AuditOutput
```
`AuditInput` = vendor + effective terms (after applying active rules) + invoices with
lines + usage totals. `AuditOutput` = findings (with fingerprint, amount, math, evidence
refs) + totals. Pure function. **Applying rules happens before checks** in
`applyRules(terms, rules)`.

Order matters (prevents double counting):
1. `DUPLICATE_BILLING` first. Exclude duplicates from all later checks.
2. Seat checks per invoice: `SEAT_CAP_EXCEEDED`, then `PRICE_ABOVE_CONTRACT` on the
   seats within the cap only.
3. Usage checks per meter: `USAGE_OVERBILLED`, then `RATE_ABOVE_CONTRACT` on
   `min(billed, logged)` only.
4. `RENEWAL_NOTICE_DEADLINE` (no recoverable amount; sets `at_risk_cents`).

### Checks
| Check | Applies to | Condition | Amount (cents) | Severity |
|---|---|---|---|---|
| `DUPLICATE_BILLING` | any | Two invoices for the same vendor with same `period_start`, `period_end` and `total_cents`. The later invoice (by date, then number) is the duplicate. | duplicate's total | breach |
| `SEAT_CAP_EXCEEDED` | seat_subscription | billed seats > effective `seat_cap` for the period | `(seats − cap) × billed unit price` | **verify** (could be approved) |
| `PRICE_ABOVE_CONTRACT` | seat_subscription | billed unit > allowed unit. Allowed = `seat_price` during initial term; after a renewal date = prior-term price × (1 + uplift cap). | `(billed − allowed) × min(seats, cap)` | breach |
| `USAGE_OVERBILLED` | usage_metered | billed qty > logged qty for meter + period (needs `usage_totals`) | `(billed − logged) × billed rate / 1M` | breach |
| `RATE_ABOVE_CONTRACT` | usage_metered | billed rate > contract `meter_rate` | `(billed rate − contract rate) × min(billed, logged) / 1M` | breach |
| `RENEWAL_NOTICE_DEADLINE` | any with `auto_renew=1`, `term_end`, `notice_days` | notice deadline = current term end − notice days; flag when deadline is within 45 days of `asOf` and in the future | `at_risk_cents` = latest monthly invoice total × 12 | deadline |

Renewal-term logic for seats: initial term from `term_start`/`term_end`; with auto-renew,
each later 12-month term starts the day after the previous end. The "current term end"
is the first term end ≥ `asOf`.

### As built (decisions made during implementation)
- **Line kinds.** `invoice_lines.kind` is `seats` | `usage` | `other`. Seat checks read
  `seats` lines only, metered checks read `usage` lines with a meter, `other` (tax, fees,
  credits) is never audited. When absent: a line with a meter is `usage`, else `seats`.
  Checks are driven by line kind, so a seat vendor with one metered line is still audited.
- **Usage priced at the billed rate.** Phantom units cost what was charged for them.
  `USAGE_OVERBILLED + RATE_ABOVE_CONTRACT` then equals `billed − fair` exactly; pricing
  them at the contract rate would under-claim by `(billed − logged) × (billed − contract rate)`
  whenever both fire on one meter. Same numbers on the sample (large input rate = contract).
- **No claim without proof.** No price finding when the period is outside the contract
  (before `term_start`, or after a term that does not auto-renew), when there is no
  `seat_price`, or when renewals happened and no `renewal_uplift_cap_bps` limits them.
  No usage finding when the export has no total for that meter inside the invoice period.
- **Agreed prices.** A `seat_price` term or rule with an `effectiveFrom` after the initial
  term start is an agreed price: it replaces the contract price from that date, and only
  later renewals are uplifted from it.
- **Several seat lines.** The first `cap` seats, in line order, are within the cap.
- **Deadline period** is the renewal term at stake (e.g. 1 Feb 2027 – 31 Jan 2028), so
  each year's renewal has its own fingerprint. At risk = latest bill × 12 ÷ months it covers.
- **Totals.** `findingCount` counts findings that carry money; deadlines are in `atRiskCents`.

Fingerprint: `sha1(vendorId, check, period_start, meter ?? "", invoice_number ?? "")`.
The invoice number is part of every invoice-scoped fingerprint (not just duplicates), so
two different invoices in one period never collide. The amount is never part of it: rules
may change an amount while the finding's status survives.
On re-run: keep `accepted`/`rejected` status for matching fingerprints; findings that
disappeared become `explained` (if an active rule touches the same check/term) or
`cleared`. The engine returns `explained` itself: findings present without rules and
absent with them, each citing the rules that removed it.

Each finding stores `math_json`, e.g.
```json
{ "formula": "(billed_unit − allowed_unit) × seats", "billed_unit": "26.16",
  "allowed_unit": "25.20", "seats": 40, "result": "38.40" }
```
and evidence references to the invoice line, the contract term(s), and usage totals.
`explanation` is a code template, e.g. *"Billed $26.16/seat; the order form caps renewal
increases at 5% over $24.00, so the most Cobalt can charge is $25.20."*

### Rules (`applyRules`)
| Type | Payload | Effect |
|---|---|---|
| `override_term` | `{ key, value, meter?, effectiveFrom?, effectiveTo? }` | Replaces the term value inside the date range |
| `waive_check` | `{ check, periodFrom?, periodTo?, meter? }` | Suppresses that check in range |

### Golden test (`engine.test.ts`) — must pass before any UI work
Load `seed/sample-structured.json` (ground truth of the sample set in engine units,
already generated) and assert:
- before rules: total `318024`; by check `PRICE_ABOVE_CONTRACT 34560`,
  `SEAT_CAP_EXCEEDED 146496`, `DUPLICATE_BILLING 125568`, `USAGE_OVERBILLED 6900`,
  `RATE_ABOVE_CONTRACT 4500`
- with rule `override_term seat_cap=48 effectiveFrom 2026-04-01`: total `176904`;
  `PRICE_ABOVE_CONTRACT 39936`, no `SEAT_CAP_EXCEEDED`
- deadline: notice `2026-12-02`, at risk `1506816`, flagged when `asOf = 2026-11-09`
Full per-finding expectations are in `seed/expected-findings.json`.

## 4. Usage export parser (`server/audit/usage.ts`)
Header-driven CSV: required `date`, `model`, `input_tokens`, `output_tokens`. Sums per
`(model, direction)` per calendar month → meters named `"<model> input"` / `"<model> output"`.
Reject rows with non-integer tokens (report row numbers). Tests with the sample CSV:
large input 389,000,000; large output 61,000,000; small input 900,000,000; small output
120,000,000.

## 5. Number guard (`server/audit/number-guard.ts`)
Applied to dispute `subject`, `intro`, `closing`. Find every money-looking token
(`$1,234.56`, `USD 12`, `12.50 dollars`). Each must equal (to the cent) one of: a selected
finding amount, the dispute total, or a value present in the evidence table.
Otherwise fail with `errorCode: "unverified_amount"` and list the offending tokens, so
the agent rewrites without inventing numbers. Tests: allowed, disallowed, formats.
