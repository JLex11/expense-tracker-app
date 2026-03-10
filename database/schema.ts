import { appSchema, tableSchema } from "@nozbe/watermelondb";

export default appSchema({
	version: 3,
	tables: [
		tableSchema({
			name: "categories",
			columns: [
				{ name: "name", type: "string" },
				{ name: "icon", type: "string" },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },
			],
		}),
		tableSchema({
			name: "expenses",
			columns: [
				{ name: "amount", type: "number" },
				{ name: "category_id", type: "string", isIndexed: true },
				{ name: "date", type: "number", isIndexed: true },
				{ name: "note", type: "string", isOptional: true },
				{ name: "payment_method", type: "string" },
				{ name: "status", type: "string", isIndexed: true },
				{ name: "origin", type: "string", isIndexed: true },
				{ name: "recurring_rule_id", type: "string", isOptional: true, isIndexed: true },
				{ name: "resolved_at", type: "number", isOptional: true },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },
			],
		}),
		tableSchema({
			name: "recurring_expense_rules",
			columns: [
				{ name: "amount", type: "number" },
				{ name: "category_id", type: "string", isIndexed: true },
				{ name: "payment_method", type: "string" },
				{ name: "note", type: "string", isOptional: true },
				{ name: "interval_value", type: "number" },
				{ name: "interval_unit", type: "string" },
				{ name: "start_date", type: "number" },
				{ name: "next_due_at", type: "number", isIndexed: true },
				{ name: "is_active", type: "boolean" },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },
			],
		}),
		tableSchema({
			name: "budgets",
			columns: [
				{ name: "category_id", type: "string", isIndexed: true },
				{ name: "month_key", type: "string", isIndexed: true },
				{ name: "limit_amount", type: "number" },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },
			],
		}),
	],
});
