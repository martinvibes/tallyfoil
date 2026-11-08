---
schedule: "0 7 * * *"
enabled: true
runAs: creator
---

# Renewal watch

Every morning: call `run-audit` with no vendor (all vendors) so deadline checks use
today's date. Then `get-overview`. If any `RENEWAL_NOTICE_DEADLINE` finding has a
notice deadline within the next 30 days, write one short summary for the user:
vendor, notice deadline, the contract clause (quote it from the finding's evidence),
and the at-risk amount exactly as returned. If nothing is due, do nothing.
