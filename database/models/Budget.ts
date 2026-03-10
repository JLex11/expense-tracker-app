import { Model } from "@nozbe/watermelondb";
import {
	date,
	field,
	readonly,
	relation,
} from "@nozbe/watermelondb/decorators";

export default class Budget extends Model {
	static table = "budgets";
	static associations = {
		categories: { type: "belongs_to", key: "category_id" },
	} as const;

	@field("category_id") categoryId!: string;
	@field("month_key") monthKey!: string;
	@field("limit_amount") limitAmount!: number;

	@readonly @date("created_at") createdAt!: Date;
	@readonly @date("updated_at") updatedAt!: Date;

	@relation("categories", "category_id") category!: any;
}
