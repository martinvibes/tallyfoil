---
name: write-dispute
description: Draft a firm, polite dispute email for a vendor from accepted or open breach findings, with the code-generated evidence table. Use when the user asks to dispute charges, write to a vendor, or get money back.
---

# Write a dispute

1. `get-vendor`. Use findings with status `accepted`, plus `open` findings with severity
   `breach`. Exclude `verify` findings unless the user accepted them. Exclude deadlines
   (mention the renewal deadline separately to the user if one is close).
2. Call `draft-dispute` with `findingIds`, a `subject`, an `intro` and a `closing`.
   - **Do not write any dollar amounts, quantities or rates yourself.** The evidence table
     and total are inserted by code. Refer to them: "the charges itemized below".
   - Intro: who we are (customer name from the documents), which contract/order form
     (quote its number), that we reviewed invoices against it, and what we're asking
     for (credit or refund of the itemized amount).
   - Closing: ask for written confirmation and the credit date within 15 business days;
     offer to walk through the evidence. Firm, polite, no threats, no legal claims.
3. If `draft-dispute` fails with `unverified_amount`, remove the listed amounts from your
   prose and retry.
4. `navigate` to the dispute. Tell the user it's ready to edit and approve. Only call
   `approve-dispute` when the user asks you to; it requires their approval.
