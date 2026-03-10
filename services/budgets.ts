import { database } from "@/database";
import type Budget from "@/database/models/Budget";
import { Q } from "@nozbe/watermelondb";

export async function upsertBudget(input: {
	categoryId: string;
	monthKey: string;
	limitAmount: number;
}) {
	let savedBudgetId: string | null = null;

	await database.write(async () => {
		const collection = database.get<Budget>("budgets");
		const existing = await collection
			.query(
				Q.where("category_id", input.categoryId),
				Q.where("month_key", input.monthKey),
			)
			.fetch();
		const budget = existing[0];

		if (budget) {
			await budget.update((draft) => {
				draft.limitAmount = input.limitAmount;
			});
			savedBudgetId = budget.id;
			return;
		}

		const created = await collection.create((draft) => {
			draft.categoryId = input.categoryId;
			draft.monthKey = input.monthKey;
			draft.limitAmount = input.limitAmount;
		});

		savedBudgetId = created.id;
	});

	return savedBudgetId;
}

export async function deleteBudget(budgetId: string) {
	await database.write(async () => {
		const budget = await database.get<Budget>("budgets").find(budgetId);
		await budget.destroyPermanently();
	});
}
