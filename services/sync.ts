import {
  synchronize,
  SyncPullArgs,
  SyncPushArgs,
} from "@nozbe/watermelondb/sync";
import { resetSyncStateForTests, setSyncState } from "@/services/sync-state";
import {
  normalizePullResponse,
  serializeChangesForApi,
} from "@/services/sync-payloads";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

let inFlightSync: Promise<number> | null = null;

function toSyncError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Sync failed");
}

function requireSyncToken(token: string | null | undefined): string {
  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    throw new Error("Sync requires an authenticated Bearer token.");
  }
  return normalizedToken;
}

async function resolveSyncToken(authToken?: string): Promise<string> {
  if (authToken !== undefined) {
    return requireSyncToken(authToken);
  }

  const { getToken } = await import("@/services/auth");
  return requireSyncToken(await getToken());
}

async function performSync(authToken?: string): Promise<number> {
  setSyncState({ isSyncing: true, error: null });

  try {
    const token = await resolveSyncToken(authToken);
    const { database } = await import("@/database");

    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }: SyncPullArgs) => {
        const url = new URL(`${API_URL}/sync`);
        url.searchParams.append(
          "last_pulled_at",
          (lastPulledAt ?? 0).toString(),
        );

        const response = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Pull failed (${response.status}): ${errorText}`);
        }

        return normalizePullResponse(await response.json());
      },
      pushChanges: async ({ changes, lastPulledAt }: SyncPushArgs) => {
        const response = await fetch(`${API_URL}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            changes: serializeChangesForApi(changes),
            last_pulled_at: lastPulledAt ?? 0,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Push failed (${response.status}): ${errorText}`);
        }
      },
      migrationsEnabledAtVersion: 1,
    });

    const syncedAt = Date.now();
    setSyncState({ isSyncing: false, error: null, lastSyncedAt: syncedAt });
    return syncedAt;
  } catch (error) {
    const syncError = toSyncError(error);
    setSyncState({ isSyncing: false, error: syncError });
    throw syncError;
  }
}

/**
 * Executes WatermelonDB synchronization and deduplicates concurrent calls.
 */
export async function sync(authToken?: string): Promise<number> {
  if (inFlightSync) {
    return inFlightSync;
  }

  const activeSync = performSync(authToken).finally(() => {
    inFlightSync = null;
  });
  inFlightSync = activeSync;
  return activeSync;
}

export function __resetSyncForTests(): void {
  inFlightSync = null;
  resetSyncStateForTests();
}
