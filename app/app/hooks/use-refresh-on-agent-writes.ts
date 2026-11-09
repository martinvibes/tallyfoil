import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const TOOL_DONE_EVENT = "agent-native:tool-done";
const CHAT_RUNNING_EVENT = "agentNative.chatRunning";
const SETTLE_MS = 250;

/**
 * Keep every on-screen total current while the agent works. When an agent tool
 * finishes, or a run ends, refetch the app's action queries, so the sidebar,
 * overview and vendor pages show what the agent just recorded without a reload.
 * Refetches are batched, so a burst of tool calls costs one round of reads.
 */
export function useRefreshOnAgentWrites() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["action"] }), SETTLE_MS);
    };
    const onRunning = (event: Event) => {
      if ((event as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning === false) refresh();
    };

    window.addEventListener(TOOL_DONE_EVENT, refresh);
    window.addEventListener(CHAT_RUNNING_EVENT, onRunning);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(TOOL_DONE_EVENT, refresh);
      window.removeEventListener(CHAT_RUNNING_EVENT, onRunning);
    };
  }, [queryClient]);
}
