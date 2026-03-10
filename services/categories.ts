import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import { loadPrefs } from "@/hooks/usePrefs";
import type RecurringExpenseRule from "@/database/models/RecurringExpenseRule";
import { translate } from "@/utils/i18n";
import { Q } from "@nozbe/watermelondb";

function t(key: string) {
	return translate(loadPrefs().language, key);
}

export async function createCategory(input: { name: string; icon: string }) {
	const normalizedName = input.name.trim();
	if (!normalizedName) {
		throw new Error(t("categoryNameRequired"));
	}

	return database.write(async () => {
		const created = await database.get<Category>("categories").create((draft) => {
			draft.name = normalizedName;
			draft.icon = input.icon;
		});

		return created.id;
	});
}

export async function updateCategory(
	categoryId: string,
	input: { name: string; icon: string },
) {
	const normalizedName = input.name.trim();
	if (!normalizedName) {
		throw new Error(t("categoryNameRequired"));
	}

	await database.write(async () => {
		const category = await database.get<Category>("categories").find(categoryId);
		await category.update((draft) => {
			draft.name = normalizedName;
			draft.icon = input.icon;
		});
	});
}

export async function deleteCategory(categoryId: string) {
	const [expenseCount, ruleCount, budgetCount] = await Promise.all([
		database
			.get<Expense>("expenses")
			.query(Q.where("category_id", categoryId))
			.fetchCount(),
		database
			.get<RecurringExpenseRule>("recurring_expense_rules")
			.query(Q.where("category_id", categoryId))
			.fetchCount(),
		database
			.get("budgets")
			.query(Q.where("category_id", categoryId))
			.fetchCount(),
	]);

	if (expenseCount > 0 || ruleCount > 0 || budgetCount > 0) {
		throw new Error(t("categoryInUse"));
	}

	await database.write(async () => {
		const category = await database.get<Category>("categories").find(categoryId);
		await category.destroyPermanently();
	});
}
