import { useSyncExternalStore } from "react";
import * as FileSystem from "expo-file-system";

export type WeekStart = "Sunday" | "Monday";
export type AppLanguage = "es" | "en";
export type NotificationType =
  | "pending_recurring"
  | "budget_threshold"
  | "budget_over";
export type BudgetAlertLevel = "threshold" | "over";

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string | number>;
  createdAt: number;
  readAt: number | null;
  actionRoute?: string | null;
  meta?: Record<string, string | number | boolean | null>;
}

export interface BudgetAlertRecord {
  id: string;
  budgetId: string;
  monthKey: string;
  level: BudgetAlertLevel;
  triggeredAt: number;
  readAt: number | null;
}

export interface Prefs {
  name: string;
  email: string;
  currency: string;
  weekStart: WeekStart;
  language: AppLanguage;
  appLockEnabled: boolean;
  budgetAlertsEnabled: boolean;
  budgetAlertThresholdPct: number;
  notifications: AppNotification[];
  budgetAlertHistory: BudgetAlertRecord[];
}

export const DEFAULT_PREFS: Prefs = {
  name: "Alex",
  email: "alex@example.com",
  currency: "USD",
  weekStart: "Sunday",
  language: "es",
  appLockEnabled: false,
  budgetAlertsEnabled: true,
  budgetAlertThresholdPct: 80,
  notifications: [],
  budgetAlertHistory: [],
};

const listeners = new Set<() => void>();
let cachedPrefs: Prefs | null = null;

function getPrefsFile() {
  return new FileSystem.File(FileSystem.Paths.document, "prefs.json");
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min?: number,
  max?: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  let normalized = value;
  if (typeof min === "number") normalized = Math.max(min, normalized);
  if (typeof max === "number") normalized = Math.min(max, normalized);
  return normalized;
}

function normalizeNullableTimestamp(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function normalizeNotification(raw: unknown): AppNotification | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<AppNotification>;

  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0)
    return null;
  if (typeof candidate.type !== "string") return null;
  if (
    typeof candidate.titleKey !== "string" ||
    candidate.titleKey.trim().length === 0
  )
    return null;
  if (
    typeof candidate.bodyKey !== "string" ||
    candidate.bodyKey.trim().length === 0
  )
    return null;

  const createdAt = normalizeNumber(candidate.createdAt, Date.now(), 0);
  const readAt = normalizeNullableTimestamp(candidate.readAt);

  return {
    id: candidate.id,
    type: candidate.type as NotificationType,
    titleKey: candidate.titleKey,
    bodyKey: candidate.bodyKey,
    params:
      candidate.params && typeof candidate.params === "object"
        ? (candidate.params as Record<string, string | number>)
        : undefined,
    createdAt,
    readAt,
    actionRoute:
      typeof candidate.actionRoute === "string"
        ? candidate.actionRoute
        : candidate.actionRoute === null
          ? null
          : undefined,
    meta:
      candidate.meta && typeof candidate.meta === "object"
        ? (candidate.meta as Record<string, string | number | boolean | null>)
        : undefined,
  };
}

function normalizeBudgetAlertRecord(raw: unknown): BudgetAlertRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<BudgetAlertRecord>;

  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0)
    return null;
  if (
    typeof candidate.budgetId !== "string" ||
    candidate.budgetId.trim().length === 0
  )
    return null;
  if (
    typeof candidate.monthKey !== "string" ||
    candidate.monthKey.trim().length === 0
  )
    return null;
  if (candidate.level !== "threshold" && candidate.level !== "over")
    return null;

  const triggeredAt = normalizeNumber(candidate.triggeredAt, Date.now(), 0);
  const readAt = normalizeNullableTimestamp(candidate.readAt);

  return {
    id: candidate.id,
    budgetId: candidate.budgetId,
    monthKey: candidate.monthKey,
    level: candidate.level,
    triggeredAt,
    readAt,
  };
}

function normalizePrefs(raw: Partial<Prefs> | null | undefined): Prefs {
  const notifications = Array.isArray(raw?.notifications)
    ? raw!.notifications
        .map((item) => normalizeNotification(item))
        .filter((item): item is AppNotification => Boolean(item))
        .sort((a, b) => b.createdAt - a.createdAt)
    : DEFAULT_PREFS.notifications;

  const budgetAlertHistory = Array.isArray(raw?.budgetAlertHistory)
    ? raw!.budgetAlertHistory
        .map((item) => normalizeBudgetAlertRecord(item))
        .filter((item): item is BudgetAlertRecord => Boolean(item))
        .sort((a, b) => b.triggeredAt - a.triggeredAt)
    : DEFAULT_PREFS.budgetAlertHistory;

  return {
    name:
      typeof raw?.name === "string" && raw.name.trim()
        ? raw.name
        : DEFAULT_PREFS.name,
    email:
      typeof raw?.email === "string" && raw.email.trim()
        ? raw.email
        : DEFAULT_PREFS.email,
    currency:
      typeof raw?.currency === "string" && raw.currency.trim()
        ? raw.currency
        : DEFAULT_PREFS.currency,
    weekStart: raw?.weekStart === "Monday" ? "Monday" : "Sunday",
    language: raw?.language === "en" ? "en" : "es",
    appLockEnabled:
      typeof raw?.appLockEnabled === "boolean"
        ? raw.appLockEnabled
        : DEFAULT_PREFS.appLockEnabled,
    budgetAlertsEnabled:
      typeof raw?.budgetAlertsEnabled === "boolean"
        ? raw.budgetAlertsEnabled
        : DEFAULT_PREFS.budgetAlertsEnabled,
    budgetAlertThresholdPct: normalizeNumber(
      raw?.budgetAlertThresholdPct,
      DEFAULT_PREFS.budgetAlertThresholdPct,
      1,
      100,
    ),
    notifications,
    budgetAlertHistory,
  };
}

function readPrefsFromDisk(): Prefs {
  try {
    const file = getPrefsFile();
    if (file.exists) {
      return normalizePrefs(JSON.parse(file.textSync()) as Partial<Prefs>);
    }
  } catch {}
  return DEFAULT_PREFS;
}

export function loadPrefs(): Prefs {
  if (cachedPrefs) return cachedPrefs;
  cachedPrefs = readPrefsFromDisk();
  return cachedPrefs;
}

export function savePrefs(prefs: Prefs) {
  try {
    const normalized = normalizePrefs(prefs);
    getPrefsFile().write(JSON.stringify(normalized));
    cachedPrefs = normalized;
    listeners.forEach((listener) => listener());
  } catch (e) {
    console.error("Failed to save prefs", e);
  }
}

export function updatePrefs(updates: Partial<Prefs>) {
  const current = loadPrefs();
  savePrefs({ ...current, ...updates });
}

export function addNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "readAt"> & {
    id?: string;
    createdAt?: number;
  },
) {
  const current = loadPrefs();
  const nextNotification: AppNotification = {
    id:
      typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: input.type,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    params: input.params,
    actionRoute: input.actionRoute,
    meta: input.meta,
    createdAt:
      typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
        ? input.createdAt
        : Date.now(),
    readAt: null,
  };

  const deduped = current.notifications.filter(
    (item) => item.id !== nextNotification.id,
  );

  savePrefs({
    ...current,
    notifications: [nextNotification, ...deduped].sort(
      (a, b) => b.createdAt - a.createdAt,
    ),
  });
}

export function markNotificationAsRead(notificationId: string) {
  const current = loadPrefs();
  const changed = current.notifications.map((item) =>
    item.id === notificationId && item.readAt === null
      ? { ...item, readAt: Date.now() }
      : item,
  );
  savePrefs({ ...current, notifications: changed });
}

export function markAllNotificationsAsRead() {
  const now = Date.now();
  const current = loadPrefs();
  const changed = current.notifications.map((item) =>
    item.readAt === null ? { ...item, readAt: now } : item,
  );
  savePrefs({ ...current, notifications: changed });
}

export function clearNotifications() {
  const current = loadPrefs();
  savePrefs({ ...current, notifications: [] });
}

export function saveBudgetAlertRecord(
  record: Omit<BudgetAlertRecord, "id" | "triggeredAt" | "readAt"> & {
    id?: string;
    triggeredAt?: number;
  },
) {
  const current = loadPrefs();
  const nextRecord: BudgetAlertRecord = {
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    budgetId: record.budgetId,
    monthKey: record.monthKey,
    level: record.level,
    triggeredAt:
      typeof record.triggeredAt === "number" &&
      Number.isFinite(record.triggeredAt)
        ? record.triggeredAt
        : Date.now(),
    readAt: null,
  };

  const deduped = current.budgetAlertHistory.filter(
    (item) => item.id !== nextRecord.id,
  );

  savePrefs({
    ...current,
    budgetAlertHistory: [nextRecord, ...deduped].sort(
      (a, b) => b.triggeredAt - a.triggeredAt,
    ),
  });
}

export function markBudgetAlertAsRead(recordId: string) {
  const current = loadPrefs();
  const changed = current.budgetAlertHistory.map((item) =>
    item.id === recordId && item.readAt === null
      ? { ...item, readAt: Date.now() }
      : item,
  );
  savePrefs({ ...current, budgetAlertHistory: changed });
}

export function clearBudgetAlertHistory() {
  const current = loadPrefs();
  savePrefs({ ...current, budgetAlertHistory: [] });
}

function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePrefs() {
  return useSyncExternalStore(subscribePrefs, loadPrefs, loadPrefs);
}

export function usePrefsSelector<T>(selector: (prefs: Prefs) => T) {
  return useSyncExternalStore(
    subscribePrefs,
    () => selector(loadPrefs()),
    () => selector(loadPrefs()),
  );
}
