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

## When the vendor replies

The user pastes the vendor's answer on the dispute page; it arrives as a `note` document
and a message naming the dispute and the document.

1. `read-document` the reply.
2. Decide the outcome: `credited` if they agreed to credit or refund any amount (in full
   or in part), `refused` if they declined or disputed every charge.
3. `record-vendor-reply` with `disputeId`, `documentId`, the outcome and 1–3 lines copied
   exactly from the reply. For a credit, one line must state the credited amount ("We
   have issued credit memo CM-2291 for $1,601.28"). Code reads the amount from that line;
   never type an amount anywhere else.
4. If it fails with `value_not_in_quote`, quote the line that states the amount. If it
   fails with `credit_exceeds_dispute`, the line you chose isn't about this dispute; find
   the right one.
5. Tell the user the result with the returned `recovered` and `total`. If it was partial
   or refused, offer to draft a follow-up for what is still open.
