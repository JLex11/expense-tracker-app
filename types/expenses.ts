export type ExpenseStatus = "confirmed" | "pending" | "skipped";
export type ExpenseOrigin = "manual" | "recurring";
export type PaymentMethod = "cash" | "card" | "transfer";
export type RecurrenceUnit = "day" | "week" | "month" | "year";

export interface RecurringRuleInput {
  intervalValue: number;
  intervalUnit: RecurrenceUnit;
}

export interface CreateExpenseInput {
  amount: number;
  categoryId: string;
  date: number;
  note?: string | null;
  paymentMethod: PaymentMethod;
  recurrence?: RecurringRuleInput | null;
}

export interface UpdateExpenseInput {
  amount?: number;
  categoryId?: string;
  date?: number;
  note?: string | null;
  paymentMethod?: PaymentMethod;
}
