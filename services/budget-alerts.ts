import { Q } from "@nozbe/watermelondb";
import { database } from "@/database";
import type Budget from "@/database/models/Budget";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import {
  addNotification,
  loadPrefs,
  saveBudgetAlertRecord,
  type BudgetAlertLevel,
} from "@/hooks/usePrefs";
import { getMonthKey } from "@/utils/months";

export interface BudgetAlertCandidate {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  monthKey: string;
  limitAmount: number;
  spentAmount: number;
  ratio: number;
  level: BudgetAlertLevel;
}

export interface EvaluateBudgetAlertsResult {
  monthKey: string;
  createdAlerts: BudgetAlertCandidate[];
  skippedAlerts: BudgetAlertCandidate[];
}

function toMonthKey(input?: string | number) {
  if (typeof input === "string" && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  return getMonthKey(typeof input === "number" ? input : Date.now());
}

function normalizeMoney(value: number) {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function wasAlreadyTriggered(
  budgetId: string,
  monthKey: string,
  level: BudgetAlertLevel,
) {
  const prefs = loadPrefs();
  return prefs.budgetAlertHistory.some(
    (item) =>
      item.budgetId === budgetId &&
      item.monthKey === monthKey &&
      item.level === level,
  );
}

function buildCandidate(
  budget: Budget,
  spentAmount: number,
  categoryName: string,
  thresholdPct: number,
): BudgetAlertCandidate | null {
  const limitAmount = normalizeMoney(budget.limitAmount);
  if (limitAmount <= 0) return null;

  const spent = normalizeMoney(spentAmount);
  const ratio = spent / limitAmount;

  if (ratio >= 1) {
    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      categoryName,
      monthKey: budget.monthKey,
      limitAmount,
      spentAmount: spent,
      ratio,
      level: "over",
    };
  }

  if (ratio >= thresholdPct / 100) {
    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      categoryName,
      monthKey: budget.monthKey,
      limitAmount,
      spentAmount: spent,
      ratio,
      level: "threshold",
    };
  }

  return null;
}

/**
 * Evaluates budgets for a month and creates deduped notifications/records.
 *
 * Dedupe key:
 *   (budgetId, monthKey, level)
 */
export async function evaluateBudgetAlerts(input?: {
  monthKey?: string;
  now?: number;
}): Promise<EvaluateBudgetAlertsResult> {
  const now = input?.now ?? Date.now();
  const monthKey = toMonthKey(input?.monthKey ?? now);
  const prefs = loadPrefs();

  if (!prefs.budgetAlertsEnabled) {
    return {
      monthKey,
      createdAlerts: [],
      skippedAlerts: [],
    };
  }

  const thresholdPct = Math.min(
    100,
    Math.max(1, prefs.budgetAlertThresholdPct || 80),
  );

  const [budgets, categories, expenses] = await Promise.all([
    database
      .get<Budget>("budgets")
      .query(Q.where("month_key", monthKey))
      .fetch(),
    database.get<Category>("categories").query().fetch(),
    database
      .get<Expense>("expenses")
      .query(Q.where("status", "confirmed"))
      .fetch(),
  ]);

  const spentByCategory = new Map<string, number>();
  for (const expense of expenses) {
    if (getMonthKey(expense.date) !== monthKey) continue;
    spentByCategory.set(
      expense.categoryId,
      (spentByCategory.get(expense.categoryId) ?? 0) + Math.abs(expense.amount),
    );
  }

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  const createdAlerts: BudgetAlertCandidate[] = [];
  const skippedAlerts: BudgetAlertCandidate[] = [];

  for (const budget of budgets) {
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    const categoryName = categoryNames.get(budget.categoryId) ?? "Unknown";
    const candidate = buildCandidate(budget, spent, categoryName, thresholdPct);

    if (!candidate) continue;

    if (
      wasAlreadyTriggered(
        candidate.budgetId,
        candidate.monthKey,
        candidate.level,
      )
    ) {
      skippedAlerts.push(candidate);
      continue;
    }

    const notificationId = `budget-${candidate.level}-${candidate.budgetId}-${candidate.monthKey}`;

    addNotification({
      id: notificationId,
      type: candidate.level === "over" ? "budget_over" : "budget_threshold",
      titleKey:
        candidate.level === "over"
          ? "budgetOverNotificationTitle"
          : "budgetThresholdNotificationTitle",
      bodyKey:
        candidate.level === "over"
          ? "budgetOverNotificationBody"
          : "budgetThresholdNotificationBody",
      params: {
        category: candidate.categoryName,
        spent: candidate.spentAmount.toFixed(2),
        limit: candidate.limitAmount.toFixed(2),
        percentage: Math.round(candidate.ratio * 100),
      },
      createdAt: now,
      actionRoute: "/(tabs)/budget",
      meta: {
        budgetId: candidate.budgetId,
        categoryId: candidate.categoryId,
        monthKey: candidate.monthKey,
        level: candidate.level,
      },
    });

    saveBudgetAlertRecord({
      id: notificationId,
      budgetId: candidate.budgetId,
      monthKey: candidate.monthKey,
      level: candidate.level,
      triggeredAt: now,
    });

    createdAlerts.push(candidate);
  }

  return {
    monthKey,
    createdAlerts,
    skippedAlerts,
  };
}
