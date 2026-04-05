export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: Error | null;
}

type SyncListener = () => void;

const initialState: SyncState = {
  isSyncing: false,
  lastSyncedAt: null,
  error: null,
};

let currentState: SyncState = initialState;
const listeners = new Set<SyncListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function getSyncStateSnapshot(): SyncState {
  return currentState;
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSyncState(nextState: Partial<SyncState>): void {
  const updatedState: SyncState = {
    ...currentState,
    ...nextState,
  };

  if (
    updatedState.isSyncing === currentState.isSyncing &&
    updatedState.lastSyncedAt === currentState.lastSyncedAt &&
    updatedState.error === currentState.error
  ) {
    return;
  }

  currentState = updatedState;
  notifyListeners();
}

export function resetSyncStateForTests(): void {
  currentState = initialState;
  listeners.clear();
}
