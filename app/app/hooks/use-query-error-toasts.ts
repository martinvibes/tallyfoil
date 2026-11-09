import { actionErrorMessage } from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * One app-wide safety net: when an action query fails to load, say so in a
 * toast instead of leaving a blank panel. One toast per query, replaced on
 * repeat failures, so a flaky connection never stacks a pile of them.
 */
export function useQueryErrorToasts() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return;
        const { queryKey, queryHash } = event.query;
        if (queryKey[0] !== "action") return;
        toast.error("Couldn't load the latest data", {
          id: `query-error:${queryHash}`,
          description: actionErrorMessage(event.action.error),
          action: { label: "Retry", onClick: () => void queryClient.refetchQueries({ queryKey }) },
        });
      }),
    [queryClient],
  );
}
