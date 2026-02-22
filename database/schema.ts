import { appSchema, tableSchema } from "@nozbe/watermelondb";

export default appSchema({
	version: 1,
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
				{ name: "date", type: "number" },
				{ name: "note", type: "string", isOptional: true },
				{ name: "payment_method", type: "string" },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },
			],
		}),
	],
});
