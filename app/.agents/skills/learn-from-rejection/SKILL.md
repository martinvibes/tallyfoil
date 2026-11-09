---
name: learn-from-rejection
description: Turn a user's reason for rejecting a finding into a vendor rule, re-run the audit, and report how the totals changed. Use when the user rejects a finding with a reason or explains why a charge is legitimate.
---

# Learn from a rejection

1. `view-screen`, then `get-finding` for the rejected finding (status `rejected`,
   `reject_reason` set). If the finding isn't rejected yet, call `review-finding` with
   `decision: "reject"` and the user's words as `reason`.
2. Decide whether the reason changes a **term** or **waives a check**:
   - "We approved 48 seats in March" → `override_term` `{key: "seat_cap", value: 48,
     effectiveFrom: "2026-04-01"}` (start of the first period the approval covers).
   - "We agreed the 9% increase in the renewal call" → `override_term`
     `{key: "renewal_uplift_cap_bps", value: 900, effectiveFrom: <renewal date>}`.
   - "That duplicate was already credited" → `waive_check`
     `{check: "DUPLICATE_BILLING", periodFrom, periodTo}`.
   - A one-off that shouldn't generalize → no rule; leave it rejected and say so.
3. **Get proof.** A rule backed by the approving email beats "your word".
   - If the message context names a proof `documentId` (the user pasted the email in the
     reject box), `read-document` it and copy 1–3 lines that state the approval
     **exactly**, including the value (e.g. "we approve increasing the seat cap to 48").
   - If there is no proof document, ask once: "Do you have the email or note that approved
     this? Paste it and I'll attach it as proof." If they paste it, `add-document` it with
     `kind: "note"` and the vendor's id, then read it and quote it as above. If they say no,
     save the rule without proof — it shows as **Your word**.
4. Ask one short question only if the scope is genuinely unclear (e.g. which month the
   approval started). Otherwise proceed.
5. `add-vendor-rule` with `reason` = the user's words verbatim, and `proof:
   {documentId, quotes}` when you have it. The action checks every quote against the
   document and re-runs the audit; if it fails with `evidence_not_found` or
   `value_not_in_quote`, re-read the lines and fix the quote — never drop the proof to make
   it pass.
6. Report in one or two sentences using only returned numbers: what the rule is, whether
   it is proven by email or on the user's word, which findings it explained, and the new
   recoverable total. Example: "Saved *seat cap 48 from April 2026*, proven by Dana's email
   of 12 March. The seat finding is now explained; the price-cap finding grew because it
   now covers 48 seats. Recoverable is $1,769.04 (was $3,180.24)."
