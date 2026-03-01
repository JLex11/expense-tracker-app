export type ExpenseStatus = "confirmed" | "pending" | "skipped";
export type ExpenseOrigin = "manual" | "recurring";
export type RecurrenceUnit = "day" | "week" | "month";

export interface RecurringRuleInput {
	intervalValue: number;
	intervalUnit: RecurrenceUnit;
}

export interface CreateExpenseInput {
	amount: number;
	categoryId: string;
	date: number;
	note?: string | null;
	paymentMethod: string;
	recurrence?: RecurringRuleInput | null;
}
