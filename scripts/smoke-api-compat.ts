import { normalizePullResponse, serializeChangesForApi } from "@/services/sync-payloads";

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

async function expectStatus(response: Response, expectedStatus: number, label: string) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `${label} failed with ${response.status}: ${await response.text()}`,
    );
  }
}

const baseUrl = resolveBaseUrl();
const email = `smoke-${Date.now()}-${crypto.randomUUID()}@example.com`;
const password = "password123";
const now = Date.now();
const categoryId = crypto.randomUUID();
const expenseId = crypto.randomUUID();
const budgetId = crypto.randomUUID();
const ruleId = crypto.randomUUID();

const registerResponse = await fetch(`${baseUrl}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
await expectStatus(registerResponse, 201, "register");

const { token } = (await registerResponse.json()) as { token: string };

const localChanges = {
  categories: {
    created: [
      {
        id: categoryId,
        name: "Smoke Food",
        icon: "cart",
        created_at: now,
        updated_at: now,
      },
    ],
    updated: [],
    deleted: [],
  },
  expenses: {
    created: [
      {
        id: expenseId,
        amount: 42.5,
        category_id: categoryId,
        date: now,
        note: "Created from smoke test",
        payment_method: "card",
        status: "pending",
        origin: "recurring",
        recurring_rule_id: ruleId,
        resolved_at: null,
        created_at: now,
        updated_at: now,
        _status: "created",
        _changed: "amount,status,origin",
      },
    ],
    updated: [],
    deleted: [],
  },
  budgets: {
    created: [
      {
        id: budgetId,
        category_id: categoryId,
        month_key: "2026-04",
        limit_amount: 200,
        created_at: now,
        updated_at: now,
      },
    ],
    updated: [],
    deleted: [],
  },
  recurring_expense_rules: {
    created: [
      {
        id: ruleId,
        amount: 42.5,
        category_id: categoryId,
        payment_method: "card",
        note: "Gym yearly",
        interval_value: 1,
        interval_unit: "year",
        start_date: now,
        next_due_at: now + 86_400_000,
        is_active: true,
        created_at: now,
        updated_at: now,
        _status: "created",
      },
    ],
    updated: [],
    deleted: [],
  },
};

const pushResponse = await fetch(`${baseUrl}/sync`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    last_pulled_at: 0,
    changes: serializeChangesForApi(localChanges as any),
  }),
});
await expectStatus(pushResponse, 200, "sync push");

const pullResponse = await fetch(`${baseUrl}/sync?last_pulled_at=0`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
await expectStatus(pullResponse, 200, "sync pull");

const normalizedPull = normalizePullResponse(await pullResponse.json());
const normalizedChanges = normalizedPull.changes as Record<
  string,
  { created: Array<Record<string, unknown>> }
>;
const pulledCategory = normalizedChanges.categories.created.find(
  (item) => item.id === categoryId,
);
const pulledExpense = normalizedChanges.expenses.created.find(
  (item) => item.id === expenseId,
);
const pulledBudget = normalizedChanges.budgets.created.find(
  (item) => item.id === budgetId,
);
const pulledRule = normalizedChanges.recurring_expense_rules.created.find(
  (item) => item.id === ruleId,
);

if (!pulledCategory || !pulledExpense || !pulledBudget || !pulledRule) {
  throw new Error(
    `Pull payload did not return all created records: ${JSON.stringify(normalizedPull)}`,
  );
}

if (
  pulledExpense.status !== "pending" ||
  pulledExpense.origin !== "recurring" ||
  pulledExpense.payment_method !== "card"
) {
  throw new Error(
    `Unexpected normalized expense payload: ${JSON.stringify(pulledExpense)}`,
  );
}

if (pulledRule.interval_unit !== "year") {
  throw new Error(
    `Unexpected normalized recurring rule payload: ${JSON.stringify(pulledRule)}`,
  );
}

const expensesResponse = await fetch(`${baseUrl}/expenses`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
await expectStatus(expensesResponse, 200, "expenses read");
const expenses = (await expensesResponse.json()) as Array<{ id: string }>;

console.log(
  JSON.stringify(
    {
      baseUrl,
      email,
      pushAccepted: true,
      pullAccepted: true,
      expensesEndpointCount: expenses.length,
      verifiedIds: {
        categoryId,
        expenseId,
        budgetId,
        ruleId,
      },
    },
    null,
    2,
  ),
);
