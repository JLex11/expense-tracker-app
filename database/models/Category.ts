import { Model } from "@nozbe/watermelondb";
import {
	children,
	date,
	field,
	readonly,
} from "@nozbe/watermelondb/decorators";

export default class Category extends Model {
	static table = "categories";
	static associations = {
		expenses: { type: "has_many", foreignKey: "category_id" },
		recurring_expense_rules: { type: "has_many", foreignKey: "category_id" },
	} as const;

	@field("name") name!: string;
	@field("icon") icon!: string;

	@readonly @date("created_at") createdAt!: Date;
	@readonly @date("updated_at") updatedAt!: Date;

	@children("expenses") expenses!: any;
}
