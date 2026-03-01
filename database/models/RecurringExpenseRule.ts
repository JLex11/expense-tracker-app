import { Model } from "@nozbe/watermelondb";
import {
	children,
	date,
	field,
	readonly,
	relation,
} from "@nozbe/watermelondb/decorators";
import type { RecurrenceUnit } from "@/types/expenses";

export default class RecurringExpenseRule extends Model {
	static table = "recurring_expense_rules";
	static associations = {
		categories: { type: "belongs_to", key: "category_id" },
		expenses: { type: "has_many", foreignKey: "recurring_rule_id" },
	} as const;

	@field("amount") amount!: number;
	@field("category_id") categoryId!: string;
	@field("payment_method") paymentMethod!: string;
	@field("note") note!: string | null;
	@field("interval_value") intervalValue!: number;
	@field("interval_unit") intervalUnit!: RecurrenceUnit;
	@field("start_date") startDate!: number;
	@field("next_due_at") nextDueAt!: number;
	@field("is_active") isActive!: boolean;

	@readonly @date("created_at") createdAt!: Date;
	@readonly @date("updated_at") updatedAt!: Date;

	@relation("categories", "category_id") category!: any;
	@children("expenses") expenses!: any;
}
