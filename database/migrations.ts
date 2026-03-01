import {
	addColumns,
	createTable,
	schemaMigrations,
	unsafeExecuteSql,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
	migrations: [
		{
			toVersion: 2,
			steps: [
				addColumns({
					table: "expenses",
					columns: [
						{ name: "status", type: "string" },
						{ name: "origin", type: "string" },
						{
							name: "recurring_rule_id",
							type: "string",
							isOptional: true,
							isIndexed: true,
						},
						{ name: "resolved_at", type: "number", isOptional: true },
					],
				}),
				createTable({
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
				unsafeExecuteSql(`
					update "expenses" set "status" = 'confirmed' where "status" is null or "status" = '';
					update "expenses" set "origin" = 'manual' where "origin" is null or "origin" = '';
					update "expenses" set "recurring_rule_id" = null where "recurring_rule_id" = '';
					update "expenses" set "resolved_at" = null where "resolved_at" = 0;
				`),
			],
		},
	],
});
