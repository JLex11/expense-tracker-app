import { describe, expect, it } from "vitest";
import {
  normalizePullResponse,
  serializeChangesForApi,
} from "@/services/sync-payloads";

describe("sync payload adapters", () => {
  it("normalizes API pull payloads into local Watermelon-shaped records", () => {
    const payload = {
      changes: {
        expenses: {
          created: [
            {
              id: "expense-1",
              amount: 99,
              categoryId: "category-1",
              date: 1000,
              note: "Remote expense",
              paymentMethod: "card",
              status: "PENDING",
              origin: "RECURRING_RULE",
              recurringRuleId: "rule-1",
              resolvedAt: null,
              createdAt: 1000,
              updatedAt: 2000,
              deletedAt: null,
            },
          ],
          updated: [],
          deleted: ["expense-2"],
        },
        categories: {
          created: [
            {
              id: "category-1",
              name: "Food",
              icon: "cart",
              createdAt: 1000,
              updatedAt: 2000,
              deletedAt: null,
            },
          ],
          updated: [],
          deleted: [],
        },
        budgets: {
          created: [],
          updated: [
            {
              id: "budget-1",
              categoryId: "category-1",
              monthKey: "2026-04",
              limitAmount: 400,
              createdAt: 1000,
              updatedAt: 3000,
              deletedAt: null,
            },
          ],
          deleted: [],
        },
        recurring_expense_rules: {
          created: [
            {
              id: "rule-1",
              amount: 99,
              categoryId: "category-1",
              paymentMethod: "card",
              note: "Gym",
              intervalValue: 1,
              intervalUnit: "YEARLY",
              startDate: 1000,
              nextDueAt: 4000,
              isActive: true,
              createdAt: 1000,
              updatedAt: 2000,
              deletedAt: null,
            },
          ],
          updated: [],
          deleted: [],
        },
      },
      timestamp: 987654,
    };

    const result = normalizePullResponse(payload);
    const changes = result.changes as Record<
      string,
      {
        created: Array<Record<string, unknown>>;
        updated: Array<Record<string, unknown>>;
        deleted: string[];
      }
    >;

    expect(result.timestamp).toBe(987654);
    expect(changes.expenses.created[0]).toEqual({
      id: "expense-1",
      amount: 99,
      category_id: "category-1",
      date: 1000,
      note: "Remote expense",
      payment_method: "card",
      status: "pending",
      origin: "recurring",
      recurring_rule_id: "rule-1",
      resolved_at: null,
      created_at: 1000,
      updated_at: 2000,
    });
    expect(changes.categories.created[0]).toEqual({
      id: "category-1",
      name: "Food",
      icon: "cart",
      created_at: 1000,
      updated_at: 2000,
    });
    expect(changes.budgets.updated[0]).toEqual({
      id: "budget-1",
      category_id: "category-1",
      month_key: "2026-04",
      limit_amount: 400,
      created_at: 1000,
      updated_at: 3000,
    });
    expect(changes.recurring_expense_rules.created[0]).toEqual({
      id: "rule-1",
      amount: 99,
      category_id: "category-1",
      payment_method: "card",
      note: "Gym",
      interval_value: 1,
      interval_unit: "year",
      start_date: 1000,
      next_due_at: 4000,
      is_active: true,
      created_at: 1000,
      updated_at: 2000,
    });
    expect(changes.expenses.deleted).toEqual(["expense-2"]);
  });

  it("fills missing tables with empty changes during pull normalization", () => {
    const result = normalizePullResponse({
      changes: {
        expenses: { created: [], updated: [], deleted: [] },
      },
      timestamp: 123,
    });

    const changes = result.changes as Record<
      string,
      {
        created: Array<Record<string, unknown>>;
        updated: Array<Record<string, unknown>>;
        deleted: string[];
      }
    >;

    expect(changes.categories).toEqual({
      created: [],
      updated: [],
      deleted: [],
    });
    expect(changes.budgets).toEqual({
      created: [],
      updated: [],
      deleted: [],
    });
    expect(changes.recurring_expense_rules).toEqual({
      created: [],
      updated: [],
      deleted: [],
    });
  });

  it("serializes local changes for the API and strips Watermelon internals", () => {
    const result = serializeChangesForApi({
      expenses: {
        created: [
          {
            id: "expense-1",
            amount: 50,
            category_id: "category-1",
            date: 1000,
            note: "Local expense",
            payment_method: "transfer",
            status: "pending",
            origin: "recurring",
            recurring_rule_id: "rule-1",
            resolved_at: null,
            created_at: 1000,
            updated_at: 2000,
            _status: "created",
            _changed: "amount,status",
          },
        ],
        updated: [],
        deleted: ["expense-2"],
      },
      categories: {
        created: [],
        updated: [
          {
            id: "category-1",
            name: "Food",
            icon: "cart",
            created_at: 1000,
            updated_at: 2000,
            _status: "updated",
          },
        ],
        deleted: [],
      },
      recurring_expense_rules: {
        created: [],
        updated: [
          {
            id: "rule-1",
            amount: 50,
            category_id: "category-1",
            payment_method: "transfer",
            note: "Annual",
            interval_value: 1,
            interval_unit: "year",
            start_date: 1000,
            next_due_at: 2000,
            is_active: true,
            created_at: 1000,
            updated_at: 3000,
            _changed: "interval_unit,next_due_at",
          },
        ],
        deleted: [],
      },
    } as any);

    expect(result.expenses.created[0]).toEqual({
      id: "expense-1",
      amount: 50,
      categoryId: "category-1",
      date: 1000,
      note: "Local expense",
      paymentMethod: "transfer",
      status: "PENDING",
      origin: "RECURRING_RULE",
      recurringRuleId: "rule-1",
      resolvedAt: null,
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(result.categories.updated[0]).toEqual({
      id: "category-1",
      name: "Food",
      icon: "cart",
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(result.recurring_expense_rules.updated[0]).toEqual({
      id: "rule-1",
      amount: 50,
      categoryId: "category-1",
      paymentMethod: "transfer",
      note: "Annual",
      intervalValue: 1,
      intervalUnit: "YEARLY",
      startDate: 1000,
      nextDueAt: 2000,
      isActive: true,
      createdAt: 1000,
      updatedAt: 3000,
    });
    expect(result.expenses.deleted).toEqual(["expense-2"]);
    expect(result.budgets).toEqual({
      created: [],
      updated: [],
      deleted: [],
    });
  });

  it("rejects malformed pull payloads early", () => {
    expect(() =>
      normalizePullResponse({
        changes: {
          expenses: {
            created: [],
            updated: {},
            deleted: [],
          },
        },
        timestamp: 123,
      }),
    ).toThrow("Invalid 'updated' list for table 'expenses'.");

    expect(() =>
      normalizePullResponse({
        changes: {},
        timestamp: "bad",
      }),
    ).toThrow("Pull response is missing a valid 'timestamp'.");
  });
});
