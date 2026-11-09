import { resourcePutIfAbsent } from "@agent-native/core/resources";

export const RENEWAL_WATCH_PATH = "jobs/renewal-watch.md";

/**
 * A daily automation the agent runs for each user: re-check deadlines against
 * today's date and warn before an auto-renewal notice window closes. Amounts
 * come from the actions, never from the model.
 */
const RENEWAL_WATCH = `---
schedule: "0 7 * * *"
enabled: true
runAs: creator
---

# Renewal watch

Every morning: call \`run-audit\` with no vendor (all vendors) so deadline checks use
today's date. Then \`get-overview\`. If any \`RENEWAL_NOTICE_DEADLINE\` finding has a
notice deadline within the next 30 days, write one short summary for the user:
vendor, notice deadline, the contract clause (quote it from the finding's evidence),
and the at-risk amount exactly as returned. If nothing is due, do nothing.
`;

/** Install the renewal watch once per user; never overwrite a copy they edited or paused. */
export const ensureRenewalWatch = async (owner: string): Promise<boolean> => {
  try {
    await resourcePutIfAbsent(owner, RENEWAL_WATCH_PATH, RENEWAL_WATCH, "text/markdown");
    return true;
  } catch (error) {
    // Scheduling is a convenience: a failure here must never block adding a vendor.
    console.warn("[tallyfoil] renewal watch not installed:", error);
    return false;
  }
};
