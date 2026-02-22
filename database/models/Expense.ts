import { Model } from "@nozbe/watermelondb";
import {
	date,
	field,
	readonly,
	relation,
} from "@nozbe/watermelondb/decorators";

export default class Expense extends Model {
	static table = "expenses";
	static associations = {
		categories: { type: "belongs_to", key: "category_id" },
	} as const;

	@field("amount") amount!: number;
	@field("category_id") categoryId!: string;
	@field("date") date!: number;
	@field("note") note!: string | null;
	@field("payment_method") paymentMethod!: string;

	@readonly @date("created_at") createdAt!: Date;
	@readonly @date("updated_at") updatedAt!: Date;

	@relation("categories", "category_id") category!: any;
}
