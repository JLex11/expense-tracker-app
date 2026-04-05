import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import Budget from "./models/Budget";
import Category from "./models/Category";
import Expense from "./models/Expense";
import RecurringExpenseRule from "./models/RecurringExpenseRule";
import { migrations } from "./migrations";
import { SEED_CATEGORIES } from "./seedCategories";
import schema from "./schema";
import { generateUuid, isUuid, setRawIdentity } from "@/utils/watermelon";

const databaseSetupError = (error: Error) => {
	console.error("Database setup error:", error);
};

const normalizeCategoryName = (name: string) => name.trim().toLowerCase();

const hasValidTimestamp = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0;

const LEGACY_SYNC_ID_MIGRATION_KEY = "legacy_sync_id_migration_v1";

export const createUuid = generateUuid;

function getTimestampMs(value: unknown, fallback: number): number {
	if (hasValidTimestamp(value)) {
		return value;
	}
	return fallback;
}

function getAdapterType() {
	return (database.adapter.underlyingAdapter.constructor as { adapterType?: string })
		.adapterType;
}

async function migrateLegacyIdsIfNeeded() {
	const localStorage = database.localStorage;
	if ((await localStorage.get(LEGACY_SYNC_ID_MIGRATION_KEY)) === "done") {
		return;
	}

	if (getAdapterType() !== "sqlite") {
		await localStorage.set(LEGACY_SYNC_ID_MIGRATION_KEY, "done");
		return;
	}

	const [categories, expenses, rules, budgets] = await Promise.all([
		database.get<Category>("categories").query().fetch(),
		database.get<Expense>("expenses").query().fetch(),
		database.get<RecurringExpenseRule>("recurring_expense_rules").query().fetch(),
		database.get<Budget>("budgets").query().fetch(),
	]);

	const now = Date.now();
	const sqls: Array<[string, (string | number | null)[]]> = [];
	const categoryIdMap = new Map<string, string>();
	const ruleIdMap = new Map<string, string>();
	const usedCategoryTargetIds = new Set<string>();
	const seedCategoryByName = new Map(
		SEED_CATEGORIES.map((seed) => [normalizeCategoryName(seed.name), seed]),
	);

	for (const category of categories) {
		const raw = category._raw as Record<string, unknown>;
		const seedCategory = seedCategoryByName.get(
			normalizeCategoryName(category.name),
		);
		let targetId = category.id;

		if (
			seedCategory &&
			seedCategory.icon === category.icon &&
			!usedCategoryTargetIds.has(seedCategory.id)
		) {
			targetId = seedCategory.id;
		} else if (!isUuid(category.id)) {
			targetId = generateUuid();
		}

		usedCategoryTargetIds.add(targetId);

		if (targetId !== category.id) {
			categoryIdMap.set(category.id, targetId);
		}

		sqls.push([
			`update "categories" set "id" = ?, "created_at" = ?, "updated_at" = ? where "id" = ?`,
			[
				targetId,
				getTimestampMs(raw.created_at, now),
				getTimestampMs(raw.updated_at, now),
				category.id,
			],
		]);
	}

	for (const rule of rules) {
		const raw = rule._raw as Record<string, unknown>;
		const targetId = isUuid(rule.id) ? rule.id : generateUuid();

		if (targetId !== rule.id) {
			ruleIdMap.set(rule.id, targetId);
		}

		sqls.push([
			`update "recurring_expense_rules" set "id" = ?, "category_id" = ?, "created_at" = ?, "updated_at" = ? where "id" = ?`,
			[
				targetId,
				categoryIdMap.get(rule.categoryId) ?? rule.categoryId,
				getTimestampMs(raw.created_at, now),
				getTimestampMs(raw.updated_at, now),
				rule.id,
			],
		]);
	}

	for (const budget of budgets) {
		const raw = budget._raw as Record<string, unknown>;
		const targetId = isUuid(budget.id) ? budget.id : generateUuid();

		sqls.push([
			`update "budgets" set "id" = ?, "category_id" = ?, "created_at" = ?, "updated_at" = ? where "id" = ?`,
			[
				targetId,
				categoryIdMap.get(budget.categoryId) ?? budget.categoryId,
				getTimestampMs(raw.created_at, now),
				getTimestampMs(raw.updated_at, now),
				budget.id,
			],
		]);
	}

	for (const expense of expenses) {
		const raw = expense._raw as Record<string, unknown>;
		const targetId = isUuid(expense.id) ? expense.id : generateUuid();
		const targetRecurringRuleId = expense.recurringRuleId
			? ruleIdMap.get(expense.recurringRuleId) ?? expense.recurringRuleId
			: null;

		sqls.push([
			`update "expenses" set "id" = ?, "category_id" = ?, "recurring_rule_id" = ?, "status" = ?, "origin" = ?, "resolved_at" = ?, "created_at" = ?, "updated_at" = ? where "id" = ?`,
			[
				targetId,
				categoryIdMap.get(expense.categoryId) ?? expense.categoryId,
				targetRecurringRuleId,
				expense.status,
				expense.origin,
				expense.resolvedAt ?? null,
				getTimestampMs(raw.created_at, now),
				getTimestampMs(raw.updated_at, now),
				expense.id,
			],
		]);
	}

	if (sqls.length > 0) {
		await database.adapter.unsafeExecute({ sqls });
	}

	await localStorage.set(LEGACY_SYNC_ID_MIGRATION_KEY, "done");
}

async function normalizeLegacySyncData() {
	const now = Date.now();

	await database.write(async () => {
		const [categories, expenses, rules, budgets] = await Promise.all([
			database.get<Category>("categories").query().fetch(),
			database.get<Expense>("expenses").query().fetch(),
			database.get<RecurringExpenseRule>("recurring_expense_rules").query().fetch(),
			database.get<Budget>("budgets").query().fetch(),
		]);

		for (const category of categories) {
			const raw = category._raw as Record<string, unknown>;
			const createdAt = hasValidTimestamp(raw.created_at) ? raw.created_at : now;
			const updatedAt = hasValidTimestamp(raw.updated_at) ? raw.updated_at : createdAt;
			if (hasValidTimestamp(raw.created_at) && hasValidTimestamp(raw.updated_at)) {
				continue;
			}
			await category.update((draft) => {
				draft._dangerouslySetRawWithoutMarkingColumnChange("created_at", createdAt);
				draft._dangerouslySetRawWithoutMarkingColumnChange("updated_at", updatedAt);
			});
		}

		for (const expense of expenses) {
			const raw = expense._raw as Record<string, unknown>;
			const createdAt = hasValidTimestamp(raw.created_at) ? raw.created_at : now;
			const updatedAt = hasValidTimestamp(raw.updated_at) ? raw.updated_at : createdAt;
			const shouldResolveLegacyPending =
				expense.status === "pending" && expense.origin === "recurring";
			if (
				hasValidTimestamp(raw.created_at) &&
				hasValidTimestamp(raw.updated_at) &&
				!shouldResolveLegacyPending
			) {
				continue;
			}
			await expense.update((draft) => {
				draft._dangerouslySetRawWithoutMarkingColumnChange("created_at", createdAt);
				draft._dangerouslySetRawWithoutMarkingColumnChange("updated_at", updatedAt);
				if (shouldResolveLegacyPending) {
					draft.status = "confirmed";
					draft.resolvedAt = draft.resolvedAt ?? now;
				}
			});
		}

		for (const rule of rules) {
			const raw = rule._raw as Record<string, unknown>;
			const createdAt = hasValidTimestamp(raw.created_at) ? raw.created_at : now;
			const updatedAt = hasValidTimestamp(raw.updated_at) ? raw.updated_at : createdAt;
			if (hasValidTimestamp(raw.created_at) && hasValidTimestamp(raw.updated_at)) {
				continue;
			}
			await rule.update((draft) => {
				draft._dangerouslySetRawWithoutMarkingColumnChange("created_at", createdAt);
				draft._dangerouslySetRawWithoutMarkingColumnChange("updated_at", updatedAt);
			});
		}

		for (const budget of budgets) {
			const raw = budget._raw as Record<string, unknown>;
			const createdAt = hasValidTimestamp(raw.created_at) ? raw.created_at : now;
			const updatedAt = hasValidTimestamp(raw.updated_at) ? raw.updated_at : createdAt;
			if (hasValidTimestamp(raw.created_at) && hasValidTimestamp(raw.updated_at)) {
				continue;
			}
			await budget.update((draft) => {
				draft._dangerouslySetRawWithoutMarkingColumnChange("created_at", createdAt);
				draft._dangerouslySetRawWithoutMarkingColumnChange("updated_at", updatedAt);
			});
		}
	});

	await migrateLegacyIdsIfNeeded();
}

function createAdapter() {
	try {
		return new SQLiteAdapter({
			schema,
			migrations,
			// Prefer the native SQLite adapter when the build exposes WatermelonDB.
			jsi: false,
			onSetUpError: databaseSetupError,
		});
	} catch (error) {
		console.warn(
			"Falling back to LokiJS adapter because WatermelonDB native SQLite is unavailable.",
			error,
		);

		return new LokiJSAdapter({
			dbName: "expense-tracker-app-fallback",
			schema,
			migrations,
			useWebWorker: false,
			useIncrementalIndexedDB: false,
			onSetUpError: databaseSetupError,
		});
	}
}

const adapter = createAdapter();

export const database = new Database({
	adapter,
	modelClasses: [Budget, Category, Expense, RecurringExpenseRule],
});

export const seedCategories = async () => {
	await normalizeLegacySyncData();

	const existingCategories = await database.get<Category>("categories").query().fetch();
	const categoriesById = new Map(existingCategories.map((category) => [category.id, category]));
	const categoriesByName = new Map(
		existingCategories.map((category) => [normalizeCategoryName(category.name), category]),
	);

	const now = Date.now();
	await database.write(async () => {
		const categoryCollection = database.get<Category>("categories");

		for (const seedCategory of SEED_CATEGORIES) {
			const byId = categoriesById.get(seedCategory.id);
			if (byId) {
				if (byId.name !== seedCategory.name || byId.icon !== seedCategory.icon) {
					await byId.update((draft) => {
						draft.name = seedCategory.name;
						draft.icon = seedCategory.icon;
					});
				}
				continue;
			}

			const byName = categoriesByName.get(normalizeCategoryName(seedCategory.name));
			if (byName) {
				if (byName.icon !== seedCategory.icon) {
					await byName.update((draft) => {
						draft.icon = seedCategory.icon;
					});
				}
				continue;
			}

			await categoryCollection.create((draft) => {
				setRawIdentity(draft as any, {
					id: seedCategory.id,
					createdAt: now,
					updatedAt: now,
				});
				draft.name = seedCategory.name;
				draft.icon = seedCategory.icon;
			});
		}
	});
};
