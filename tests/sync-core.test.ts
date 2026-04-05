import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSynchronize = vi.fn();

vi.mock("@nozbe/watermelondb/sync", () => ({
  synchronize: mockSynchronize,
}));

vi.mock("@/database", () => ({
  database: {},
}));

vi.mock("@/database/index", () => ({
  database: {},
}));

vi.mock("better-sqlite3", () => ({
  default: vi.fn(),
}));

import { __resetSyncForTests, sync } from "@/services/sync";
import { getSyncStateSnapshot } from "@/services/sync-state";

const originalFetch = globalThis.fetch;

describe("sync core", () => {
  beforeEach(() => {
    __resetSyncForTests();
    mockSynchronize.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("requires a bearer token and surfaces the error state", async () => {
    await expect(sync("")).rejects.toThrow(
      "Sync requires an authenticated Bearer token.",
    );

    expect(mockSynchronize).not.toHaveBeenCalled();
    expect(getSyncStateSnapshot().isSyncing).toBe(false);
    expect(getSyncStateSnapshot().error?.message).toContain("Bearer token");
  });

  it("normalizes API payloads for pull/push and auth headers", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const serverChanges = {
      expenses: {
        created: [
          {
            id: "e-1",
            categoryId: "c-1",
            paymentMethod: "card",
            status: "PENDING",
            origin: "RECURRING_RULE",
            recurringRuleId: "r-1",
            resolvedAt: null,
            createdAt: 10,
            updatedAt: 10,
            deletedAt: null,
          },
        ],
        updated: [
          {
            id: "e-2",
            categoryId: "c-2",
            paymentMethod: "cash",
            status: "CONFIRMED",
            origin: "MANUAL",
            recurringRuleId: null,
            resolvedAt: null,
            createdAt: 15,
            updatedAt: 20,
            deletedAt: null,
          },
        ],
        deleted: ["e-3"],
      },
      categories: { created: [], updated: [], deleted: [] },
      budgets: { created: [], updated: [], deleted: [] },
      recurring_expense_rules: {
        created: [
          {
            id: "r-1",
            amount: 15,
            categoryId: "c-1",
            paymentMethod: "card",
            note: "Gym",
            intervalValue: 1,
            intervalUnit: "YEARLY",
            startDate: 100,
            nextDueAt: 200,
            isActive: true,
            createdAt: 100,
            updatedAt: 110,
            deletedAt: null,
          },
        ],
        updated: [],
        deleted: [],
      },
    };

    const localChanges = {
      expenses: {
        created: [
          {
            id: "l-1",
            category_id: "c-2",
            payment_method: "transfer",
            status: "pending",
            origin: "recurring",
            recurring_rule_id: "r-9",
            resolved_at: null,
            created_at: 30,
            updated_at: 30,
            _status: "created",
            _changed: "amount,status",
          },
        ],
        updated: [
          {
            id: "l-2",
            category_id: "c-3",
            payment_method: "cash",
            status: "confirmed",
            origin: "manual",
            recurring_rule_id: null,
            resolved_at: 45,
            created_at: 35,
            updated_at: 40,
            _status: "updated",
          },
        ],
        deleted: ["l-3"],
      },
      categories: { created: [], updated: [], deleted: [] },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: serverChanges, timestamp: 1710850000000 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      });

    mockSynchronize.mockImplementation(
      async ({
        pullChanges,
        pushChanges,
      }: {
        pullChanges: (args: any) => Promise<any>;
        pushChanges: (args: any) => Promise<any>;
      }) => {
        const pullResult = await pullChanges({ lastPulledAt: 1710845600000 });
        expect(pullResult).toEqual({
          changes: {
            expenses: {
              created: [
                {
                  id: "e-1",
                  category_id: "c-1",
                  payment_method: "card",
                  status: "pending",
                  origin: "recurring",
                  recurring_rule_id: "r-1",
                  resolved_at: null,
                  created_at: 10,
                  updated_at: 10,
                },
              ],
              updated: [
                {
                  id: "e-2",
                  category_id: "c-2",
                  payment_method: "cash",
                  status: "confirmed",
                  origin: "manual",
                  recurring_rule_id: null,
                  resolved_at: null,
                  created_at: 15,
                  updated_at: 20,
                },
              ],
              deleted: ["e-3"],
            },
            categories: { created: [], updated: [], deleted: [] },
            budgets: { created: [], updated: [], deleted: [] },
            recurring_expense_rules: {
              created: [
                {
                  id: "r-1",
                  amount: 15,
                  category_id: "c-1",
                  payment_method: "card",
                  note: "Gym",
                  interval_value: 1,
                  interval_unit: "year",
                  start_date: 100,
                  next_due_at: 200,
                  is_active: true,
                  created_at: 100,
                  updated_at: 110,
                },
              ],
              updated: [],
              deleted: [],
            },
          },
          timestamp: 1710850000000,
        });

        await pushChanges({
          changes: localChanges,
          lastPulledAt: 1710850000000,
        });
      },
    );

    const lastSyncedAt = await sync("jwt-token");

    expect(typeof lastSyncedAt).toBe("number");
    expect(lastSyncedAt).toBeGreaterThan(0);
    expect(getSyncStateSnapshot().isSyncing).toBe(false);
    expect(getSyncStateSnapshot().error).toBeNull();
    expect(getSyncStateSnapshot().lastSyncedAt).toBe(lastSyncedAt);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [pullUrl, pullInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(pullUrl).toContain("/api/sync");
    expect(pullUrl).toContain("last_pulled_at=1710845600000");
    expect(pullInit.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer jwt-token",
    });

    const [pushUrl, pushInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(pushUrl).toContain("/api/sync");
    expect(pushInit.method).toBe("POST");
    expect(pushInit.headers).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer jwt-token",
    });
    expect(JSON.parse(String(pushInit.body))).toEqual({
      changes: {
        expenses: {
          created: [
            {
              id: "l-1",
              categoryId: "c-2",
              paymentMethod: "transfer",
              status: "PENDING",
              origin: "RECURRING_RULE",
              recurringRuleId: "r-9",
              resolvedAt: null,
              createdAt: 30,
              updatedAt: 30,
            },
          ],
          updated: [
            {
              id: "l-2",
              categoryId: "c-3",
              paymentMethod: "cash",
              status: "CONFIRMED",
              origin: "MANUAL",
              recurringRuleId: null,
              resolvedAt: 45,
              createdAt: 35,
              updatedAt: 40,
            },
          ],
          deleted: ["l-3"],
        },
        categories: { created: [], updated: [], deleted: [] },
        budgets: { created: [], updated: [], deleted: [] },
        recurring_expense_rules: { created: [], updated: [], deleted: [] },
      },
      last_pulled_at: 1710850000000,
    });
  });

  it("shares one in-flight promise across concurrent sync calls", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchMock
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          changes: {
            expenses: { created: [], updated: [], deleted: [] },
          },
          timestamp: 1,
        }),
        text: async () => "",
      });

    let resolveSync!: () => void;
    const syncGate = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });

    mockSynchronize.mockImplementation(
      async ({
        pullChanges,
        pushChanges,
      }: {
        pullChanges: (args: any) => Promise<any>;
        pushChanges: (args: any) => Promise<any>;
      }) => {
        await pullChanges({ lastPulledAt: 0 });
        await pushChanges({
          changes: { expenses: { created: [], updated: [], deleted: [] } },
          lastPulledAt: 1,
        });
        await syncGate;
      },
    );

    const runA = sync("jwt-token");
    const runB = sync("jwt-token");

    resolveSync();
    const [syncedAtA, syncedAtB] = await Promise.all([runA, runB]);

    expect(syncedAtA).toBe(syncedAtB);
    expect(mockSynchronize).toHaveBeenCalledTimes(1);
    expect(getSyncStateSnapshot().isSyncing).toBe(false);
  });
});
