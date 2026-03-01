import { Q } from "@nozbe/watermelondb";
import { database } from "@/database";
import type Expense from "@/database/models/Expense";
import type RecurringExpenseRule from "@/database/models/RecurringExpenseRule";
import type {
	CreateExpenseInput,
	ExpenseOrigin,
	ExpenseStatus,
	RecurringRuleInput,
} from "@/types/expenses";
import {
	addRecurringInterval,
	getNextOccurrenceOnOrAfter,
	startOfLocalDay,
} from "@/utils/recurrence";

const CONFIRMED_STATUS: ExpenseStatus = "confirmed";
const PENDING_STATUS: ExpenseStatus = "pending";
const SKIPPED_STATUS: ExpenseStatus = "skipped";
const MANUAL_ORIGIN: ExpenseOrigin = "manual";
const RECURRING_ORIGIN: ExpenseOrigin = "recurring";

export async function createExpenseWithOptionalRecurrence(
	input: CreateExpenseInput,
) {
	let createdExpenseId: string | null = null;
	let createdRuleId: string | null = null;

	await database.write(async () => {
		let recurringRule: RecurringExpenseRule | null = null;

		if (input.recurrence) {
			recurringRule = await createRecurringRuleFromSeed(input, input.recurrence);
			createdRuleId = recurringRule.id;
		}

		const createdExpense = await database
			.get<Expense>("expenses")
			.create((expense) => {
				assignExpenseFields(expense, {
					amount: input.amount,
					categoryId: input.categoryId,
					date: input.date,
					note: input.note,
					paymentMethod: input.paymentMethod,
					status: CONFIRMED_STATUS,
					origin: recurringRule ? RECURRING_ORIGIN : MANUAL_ORIGIN,
					recurringRuleId: recurringRule?.id ?? null,
					resolvedAt: null,
				});
			});

		createdExpenseId = createdExpense.id;
	});

	return {
		expenseId: createdExpenseId,
		recurringRuleId: createdRuleId,
	};
}

export async function convertExpenseToRecurring(
	expenseId: string,
	recurrence: RecurringRuleInput,
) {
	let createdRuleId: string | null = null;

	await database.write(async () => {
		const expense = await database.get<Expense>("expenses").find(expenseId);

		if (expense.recurringRuleId) {
			createdRuleId = expense.recurringRuleId;
			return;
		}

		const recurringRule = await createRecurringRuleFromSeed(
			{
				amount: expense.amount,
				categoryId: expense.categoryId,
				date: expense.date,
				note: expense.note,
				paymentMethod: expense.paymentMethod,
			},
			recurrence,
		);

		await expense.update((draft) => {
			draft.origin = RECURRING_ORIGIN;
			draft.status = CONFIRMED_STATUS;
			draft.recurringRuleId = recurringRule.id;
		});

		createdRuleId = recurringRule.id;
	});

	return createdRuleId;
}

export async function updateRecurringRule(
	ruleId: string,
	recurrence: RecurringRuleInput,
) {
	await database.write(async () => {
		const rule = await database
			.get<RecurringExpenseRule>("recurring_expense_rules")
			.find(ruleId);
		const expenses = await database
			.get<Expense>("expenses")
			.query(Q.where("recurring_rule_id", rule.id))
			.fetch();
		const latestKnownDate = expenses.reduce(
			(maxDate, expense) => Math.max(maxDate, expense.date),
			rule.startDate,
		);
		const recalculatedNextDue = addRecurringInterval(
			latestKnownDate,
			recurrence,
			rule.startDate,
		);
		const nextDueAt = getNextOccurrenceOnOrAfter(
			recalculatedNextDue,
			recurrence,
			Date.now(),
		);

		await rule.update((draft) => {
			draft.intervalValue = recurrence.intervalValue;
			draft.intervalUnit = recurrence.intervalUnit;
			draft.nextDueAt = nextDueAt;
		});
	});
}

export async function toggleRecurringRule(ruleId: string, isActive: boolean) {
	await database.write(async () => {
		const rule = await database
			.get<RecurringExpenseRule>("recurring_expense_rules")
			.find(ruleId);

		await rule.update((draft) => {
			draft.isActive = isActive;
			if (isActive) {
				draft.nextDueAt = getNextOccurrenceOnOrAfter(
					rule.nextDueAt,
					{
						intervalValue: rule.intervalValue,
						intervalUnit: rule.intervalUnit,
					},
					Date.now(),
				);
			}
		});
	});
}

export async function syncRecurringExpenses(now = Date.now()) {
	const todayStart = startOfLocalDay(now);
	let createdCount = 0;

	await database.write(async () => {
		const rules = await database
			.get<RecurringExpenseRule>("recurring_expense_rules")
			.query(Q.where("is_active", true))
			.fetch();

		for (const rule of rules) {
			if (startOfLocalDay(rule.nextDueAt) > todayStart) {
				continue;
			}

			const recurrence = {
				intervalValue: rule.intervalValue,
				intervalUnit: rule.intervalUnit,
			} satisfies RecurringRuleInput;
			const existingExpenses = await database
				.get<Expense>("expenses")
				.query(Q.where("recurring_rule_id", rule.id))
				.fetch();
			const existingDates = new Set(
				existingExpenses.map((expense) => expense.date.toString()),
			);

			let nextDueAt = rule.nextDueAt;

			while (startOfLocalDay(nextDueAt) <= todayStart) {
				if (!existingDates.has(nextDueAt.toString())) {
					await database.get<Expense>("expenses").create((expense) => {
						assignExpenseFields(expense, {
							amount: rule.amount,
							categoryId: rule.categoryId,
							date: nextDueAt,
							note: rule.note,
							paymentMethod: rule.paymentMethod,
							status: PENDING_STATUS,
							origin: RECURRING_ORIGIN,
							recurringRuleId: rule.id,
							resolvedAt: null,
						});
					});
					existingDates.add(nextDueAt.toString());
					createdCount += 1;
				}

				nextDueAt = addRecurringInterval(nextDueAt, recurrence, rule.startDate);
			}

			await rule.update((draft) => {
				draft.nextDueAt = nextDueAt;
			});
		}
	});

	const pendingCount = await getPendingRecurringCount();

	return { createdCount, pendingCount };
}

export async function confirmPendingExpense(expenseId: string) {
	await resolvePendingExpense(expenseId, CONFIRMED_STATUS);
}

export async function skipPendingExpense(expenseId: string) {
	await resolvePendingExpense(expenseId, SKIPPED_STATUS);
}

export async function getPendingRecurringCount() {
	return database
		.get<Expense>("expenses")
		.query(
			Q.where("status", PENDING_STATUS),
			Q.where("origin", RECURRING_ORIGIN),
		)
		.fetchCount();
}

async function resolvePendingExpense(
	expenseId: string,
	nextStatus: typeof CONFIRMED_STATUS | typeof SKIPPED_STATUS,
) {
	await database.write(async () => {
		const expense = await database.get<Expense>("expenses").find(expenseId);

		if (expense.status !== PENDING_STATUS) {
			return;
		}

		await expense.update((draft) => {
			draft.status = nextStatus;
			draft.resolvedAt = Date.now();
		});
	});
}

async function createRecurringRuleFromSeed(
	input: CreateExpenseInput,
	recurrence: RecurringRuleInput,
) {
	return database
		.get<RecurringExpenseRule>("recurring_expense_rules")
		.create((rule) => {
			rule.amount = input.amount;
			rule.categoryId = input.categoryId;
			rule.paymentMethod = input.paymentMethod;
			rule.note = input.note ?? null;
			rule.intervalValue = recurrence.intervalValue;
			rule.intervalUnit = recurrence.intervalUnit;
			rule.startDate = input.date;
			rule.nextDueAt = addRecurringInterval(input.date, recurrence, input.date);
			rule.isActive = true;
		});
}

function assignExpenseFields(
	expense: Expense,
	input: {
		amount: number;
		categoryId: string;
		date: number;
		note?: string | null;
		paymentMethod: string;
		status: ExpenseStatus;
		origin: ExpenseOrigin;
		recurringRuleId: string | null;
		resolvedAt: number | null;
	},
) {
	expense.amount = input.amount;
	expense.categoryId = input.categoryId;
	expense.date = input.date;
	expense.note = input.note?.trim() ? input.note.trim() : null;
	expense.paymentMethod = input.paymentMethod;
	expense.status = input.status;
	expense.origin = input.origin;
	expense.recurringRuleId = input.recurringRuleId;
	expense.resolvedAt = input.resolvedAt;
}
