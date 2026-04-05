import { normalizePullResponse, serializeChangesForApi } from "@/services/sync-payloads";

type TableChanges = {
  created: Array<Record<string, unknown>>;
  updated: Array<Record<string, unknown>>;
  deleted: string[];
};

function resolveBaseUrl() {
  const cliUrl = process.argv[2]?.trim();
  const envUrl =
    process.env.EXPENSE_TRACKER_SMOKE_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_API_URL?.trim();
  const baseUrl = cliUrl || envUrl;

  if (!baseUrl) {
    throw new Error(
      "Provide the API base URL as the first argument or set EXPENSE_TRACKER_SMOKE_API_URL.",
    );
  }

  return baseUrl.replace(/\/$/, "");
}

async function expectStatus(
  response: Response,
  expectedStatus: number,
  label: string,
) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `${label} failed with ${response.status}: ${await response.text()}`,
    );
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyChanges() {
  return {
    categories: { created: [], updated: [], deleted: [] },
    expenses: { created: [], updated: [], deleted: [] },
    budgets: { created: [], updated: [], deleted: [] },
    recurring_expense_rules: { created: [], updated: [], deleted: [] },
  } as Record<string, TableChanges>;
}

function getCreatedRecord(
  changes: Record<string, TableChanges>,
  tableName: string,
  id: string,
) {
  return changes[tableName].created.find((item) => item.id === id);
}

function getUpdatedRecord(
  changes: Record<string, TableChanges>,
  tableName: string,
  id: string,
) {
  return changes[tableName].updated.find((item) => item.id === id);
}

const baseUrl = resolveBaseUrl();
const email = `conflict-${Date.now()}-${crypto.randomUUID()}@example.com`;
const password = "password123";

const categoryId = crypto.randomUUID();
const expenseId = crypto.randomUUID();

const registerResponse = await fetch(`${baseUrl}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
await expectStatus(registerResponse, 201, "register");
const { token } = (await registerResponse.json()) as { token: string };

const authHeaders = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const initialPullResponse = await fetch(`${baseUrl}/sync?last_pulled_at=0`, {
  headers: { Authorization: `Bearer ${token}` },
});
await expectStatus(initialPullResponse, 200, "initial pull");
const initialPull = normalizePullResponse(await initialPullResponse.json());
const initialTimestamp = initialPull.timestamp;
const createdAt = initialTimestamp + 1_000;
const updatedAt1 = createdAt + 1_000;

const createChanges = emptyChanges();
createChanges.categories.created.push({
  id: categoryId,
  name: "Conflict Category",
  icon: "cart",
  created_at: createdAt,
  updated_at: createdAt,
});
createChanges.expenses.created.push({
  id: expenseId,
  amount: 50,
  category_id: categoryId,
  date: createdAt,
  note: "initial note",
  payment_method: "card",
  status: "confirmed",
  origin: "manual",
  recurring_rule_id: null,
  resolved_at: null,
  created_at: createdAt,
  updated_at: updatedAt1,
  _status: "created",
});

const createResponse = await fetch(`${baseUrl}/sync`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    last_pulled_at: 0,
    changes: serializeChangesForApi(createChanges as any),
  }),
});
await expectStatus(createResponse, 200, "create push");
await sleep(2_500);

const clientBPullAfterCreateResponse = await fetch(
  `${baseUrl}/sync?last_pulled_at=${initialTimestamp}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
await expectStatus(clientBPullAfterCreateResponse, 200, "client B pull after create");
const clientBPullAfterCreate = normalizePullResponse(
  await clientBPullAfterCreateResponse.json(),
);
const clientBChangesAfterCreate =
  clientBPullAfterCreate.changes as Record<string, TableChanges>;

if (!getCreatedRecord(clientBChangesAfterCreate, "categories", categoryId)) {
  throw new Error("Client B did not receive the created category.");
}

const createdExpenseForClientB = getCreatedRecord(
  clientBChangesAfterCreate,
  "expenses",
  expenseId,
);
if (!createdExpenseForClientB || createdExpenseForClientB.note !== "initial note") {
  throw new Error("Client B did not receive the created expense.");
}

const clientBLastPulledAt = clientBPullAfterCreate.timestamp;
const staleUpdatedAt = updatedAt1 - 500;
const freshUpdatedAt = Math.max(updatedAt1 + 2_000, clientBLastPulledAt + 1_000);

const staleUpdateChanges = emptyChanges();
staleUpdateChanges.expenses.updated.push({
  id: expenseId,
  amount: 50,
  category_id: categoryId,
  date: createdAt,
  note: "stale note",
  payment_method: "card",
  status: "confirmed",
  origin: "manual",
  recurring_rule_id: null,
  resolved_at: null,
  created_at: createdAt,
  updated_at: staleUpdatedAt,
  _status: "updated",
  _changed: "note,updated_at",
});

const staleUpdateResponse = await fetch(`${baseUrl}/sync`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    last_pulled_at: clientBLastPulledAt,
    changes: serializeChangesForApi(staleUpdateChanges as any),
  }),
});
await expectStatus(staleUpdateResponse, 200, "stale update push");

const verifyStaleResponse = await fetch(
  `${baseUrl}/sync?last_pulled_at=${clientBLastPulledAt}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
await expectStatus(verifyStaleResponse, 200, "verify stale update");
const verifyStalePull = normalizePullResponse(await verifyStaleResponse.json());
const verifyStaleChanges = verifyStalePull.changes as Record<string, TableChanges>;

if (
  getUpdatedRecord(verifyStaleChanges, "expenses", expenseId) ||
  getCreatedRecord(verifyStaleChanges, "expenses", expenseId)
) {
  throw new Error("Stale update should have been ignored, but the expense still appeared in pull.");
}

const freshUpdateChanges = emptyChanges();
freshUpdateChanges.expenses.updated.push({
  id: expenseId,
  amount: 50,
  category_id: categoryId,
  date: createdAt,
  note: "fresh note",
  payment_method: "card",
  status: "confirmed",
  origin: "manual",
  recurring_rule_id: null,
  resolved_at: null,
  created_at: createdAt,
  updated_at: freshUpdatedAt,
  _status: "updated",
  _changed: "note,updated_at",
});

const freshUpdateResponse = await fetch(`${baseUrl}/sync`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    last_pulled_at: clientBLastPulledAt,
    changes: serializeChangesForApi(freshUpdateChanges as any),
  }),
});
await expectStatus(freshUpdateResponse, 200, "fresh update push");
await sleep(1_500);

const pullAfterFreshResponse = await fetch(
  `${baseUrl}/sync?last_pulled_at=${clientBLastPulledAt}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
await expectStatus(pullAfterFreshResponse, 200, "pull after fresh update");
const pullAfterFresh = normalizePullResponse(await pullAfterFreshResponse.json());
const freshChanges = pullAfterFresh.changes as Record<string, TableChanges>;
const freshExpense =
  getUpdatedRecord(freshChanges, "expenses", expenseId) ??
  getCreatedRecord(freshChanges, "expenses", expenseId);

if (!freshExpense || freshExpense.note !== "fresh note") {
  throw new Error(`Fresh update was not applied: ${JSON.stringify(freshExpense)}`);
}

const lastPulledBeforeDelete = pullAfterFresh.timestamp;

const staleDeleteChanges = emptyChanges();
staleDeleteChanges.expenses.deleted.push(expenseId);

const staleDeleteResponse = await fetch(`${baseUrl}/sync`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    last_pulled_at: clientBLastPulledAt,
    changes: serializeChangesForApi(staleDeleteChanges as any),
  }),
});
await expectStatus(staleDeleteResponse, 200, "stale delete push");

const expensesAfterStaleDeleteResponse = await fetch(`${baseUrl}/expenses`, {
  headers: { Authorization: `Bearer ${token}` },
});
await expectStatus(expensesAfterStaleDeleteResponse, 200, "expenses after stale delete");
const expensesAfterStaleDelete = (await expensesAfterStaleDeleteResponse.json()) as Array<{
  id: string;
  note: string | null;
}>;
const expenseAfterStaleDelete = expensesAfterStaleDelete.find(
  (item) => item.id === expenseId,
);

if (!expenseAfterStaleDelete || expenseAfterStaleDelete.note !== "fresh note") {
  throw new Error("Stale delete should have been ignored, but the record was changed or removed.");
}

const validDeleteChanges = emptyChanges();
validDeleteChanges.expenses.deleted.push(expenseId);

const validDeleteResponse = await fetch(`${baseUrl}/sync`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({
    last_pulled_at: lastPulledBeforeDelete,
    changes: serializeChangesForApi(validDeleteChanges as any),
  }),
});
await expectStatus(validDeleteResponse, 200, "valid delete push");

const clientBPullAfterDeleteResponse = await fetch(
  `${baseUrl}/sync?last_pulled_at=${clientBLastPulledAt}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
await expectStatus(clientBPullAfterDeleteResponse, 200, "client B pull after delete");
const clientBPullAfterDelete = normalizePullResponse(
  await clientBPullAfterDeleteResponse.json(),
);
const deleteChanges = clientBPullAfterDelete.changes as Record<string, TableChanges>;

if (!deleteChanges.expenses.deleted.includes(expenseId)) {
  throw new Error("Client B did not receive the deleted expense id on pull.");
}

const finalExpensesResponse = await fetch(`${baseUrl}/expenses`, {
  headers: { Authorization: `Bearer ${token}` },
});
await expectStatus(finalExpensesResponse, 200, "final expenses read");
const finalExpenses = (await finalExpensesResponse.json()) as Array<{ id: string }>;

if (finalExpenses.some((item) => item.id === expenseId)) {
  throw new Error("Deleted expense still appears in GET /expenses.");
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      email,
      checks: {
        staleUpdateIgnored: true,
        freshUpdateApplied: true,
        staleDeleteIgnored: true,
        validDeletePropagatedToClientB: true,
        expensesEndpointExcludesDeleted: true,
      },
      ids: {
        categoryId,
        expenseId,
      },
      timestamps: {
        initialTimestamp,
        clientBLastPulledAt,
        lastPulledBeforeDelete,
      },
    },
    null,
    2,
  ),
);
