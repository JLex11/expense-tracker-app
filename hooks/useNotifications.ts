import { useMemo } from "react";
import { usePendingRecurringExpenses } from "@/hooks/usePendingRecurringExpenses";
import {
  type AppNotification,
  type NotificationType,
  usePrefsSelector,
} from "@/hooks/usePrefs";

export interface DerivedNotification {
  id: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string | number>;
  createdAt: number;
  readAt: number | null;
  actionRoute?: string | null;
  source: "persisted" | "derived";
  meta?: Record<string, string | number | boolean | null>;
}

export interface UseNotificationsResult {
  notifications: DerivedNotification[];
  unreadCount: number;
  persistedUnreadCount: number;
  derivedUnreadCount: number;
}

function mapPersistedNotification(
  notification: AppNotification,
): DerivedNotification {
  return {
    id: notification.id,
    type: notification.type,
    titleKey: notification.titleKey,
    bodyKey: notification.bodyKey,
    params: notification.params,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    actionRoute: notification.actionRoute,
    source: "persisted",
    meta: notification.meta,
  };
}

export function useNotifications(): UseNotificationsResult {
  const persistedNotifications = usePrefsSelector(
    (prefs) => prefs.notifications,
  );
  const pendingRecurringExpenses = usePendingRecurringExpenses();

  const notifications = useMemo<DerivedNotification[]>(() => {
    const persisted = persistedNotifications.map(mapPersistedNotification);

    const pendingCount = pendingRecurringExpenses.length;
    const hasPendingRecurring = pendingCount > 0;
    const latestPendingDate = hasPendingRecurring
      ? Math.max(...pendingRecurringExpenses.map((expense) => expense.date))
      : Date.now();

    const pendingRecurringNotification: DerivedNotification[] =
      hasPendingRecurring
        ? [
            {
              id: `pending-recurring-summary-${pendingCount}-${latestPendingDate}`,
              type: "pending_recurring",
              titleKey: "pendingReviewTitle",
              bodyKey: "pendingReviewBody",
              params: {
                count: pendingCount,
                label:
                  pendingCount === 1
                    ? "pendingExpenseLabelOne"
                    : "pendingExpenseLabelMany",
              },
              createdAt: latestPendingDate,
              readAt: null,
              actionRoute: "/(tabs)/budget",
              source: "derived",
              meta: {
                pendingCount,
                labelKey:
                  pendingCount === 1
                    ? "pendingExpenseLabelOne"
                    : "pendingExpenseLabelMany",
              },
            },
          ]
        : [];

    return [...persisted, ...pendingRecurringNotification].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }, [persistedNotifications, pendingRecurringExpenses]);

  const persistedUnreadCount = useMemo(
    () =>
      persistedNotifications.filter((notification) => notification.readAt === null)
        .length,
    [persistedNotifications],
  );

  const derivedUnreadCount = useMemo(
    () => (pendingRecurringExpenses.length > 0 ? 1 : 0),
    [pendingRecurringExpenses.length],
  );

  return {
    notifications,
    unreadCount: persistedUnreadCount + derivedUnreadCount,
    persistedUnreadCount,
    derivedUnreadCount,
  };
}
