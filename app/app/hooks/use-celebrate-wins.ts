import { useActionQuery } from "@agent-native/core/client/hooks";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { celebrate } from "@/lib/celebrate";
import { formatUsd, type Overview } from "@/lib/tally";

/**
 * Celebrate when the ledger grows while the user watches: the agent's audit
 * finds recoverable money, or a vendor reply credits some back. Compares each
 * fresh overview with the last one seen, so loading a page never fires it.
 * Every amount shown comes from the overview action (the engine), not the UI.
 */
export function useCelebrateWins() {
  const { data } = useActionQuery<Overview>("get-overview", {});
  const last = useRef<{ recoverable: number; recovered: number } | null>(null);

  useEffect(() => {
    if (!data) return;
    const now = { recoverable: data.totals.recoverableCents, recovered: data.recovered.cents };
    const before = last.current;
    last.current = now;
    if (!before) return;

    if (now.recovered > before.recovered) {
      celebrate("recovered");
      toast.success(`${formatUsd(now.recovered - before.recovered)} recovered`, {
        description: "The vendor's reply credits it back. It's on the overview now.",
      });
    } else if (now.recoverable > before.recoverable && before.recoverable === 0) {
      celebrate("found");
      toast.success(`${formatUsd(now.recoverable)} recoverable`, {
        description: `${data.totals.findingCount} findings, each quoted from the contract and the bill.`,
      });
    } else if (now.recoverable > before.recoverable) {
      toast.success(`${formatUsd(now.recoverable - before.recoverable)} more recoverable`, {
        description: `Now ${formatUsd(now.recoverable)} in total.`,
      });
    }
  }, [data]);
}
