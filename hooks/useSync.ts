import { useCallback, useSyncExternalStore } from "react";
import { sync } from "@/services/sync";
import {
  getSyncStateSnapshot,
  subscribeSyncState,
} from "@/services/sync-state";

/**
 * Hook to manage synchronization state and execution in UI components.
 */
export function useSync() {
  const state = useSyncExternalStore(
    subscribeSyncState,
    getSyncStateSnapshot,
    getSyncStateSnapshot,
  );

  const syncNow = useCallback(
    async (token?: string) => {
      return sync(token);
    },
    [],
  );

  return {
    syncNow,
    isSyncing: state.isSyncing,
    lastSyncedAt: state.lastSyncedAt,
    error: state.error,
  };
}
