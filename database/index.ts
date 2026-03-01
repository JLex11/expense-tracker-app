import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import Category from "./models/Category";
import Expense from "./models/Expense";
import schema from "./schema";

const adapter = new SQLiteAdapter({
	schema,
	jsi: true /* use JSI for Expo SDK 52 */,
	onSetUpError: (error) => {
		console.error("Database setup error:", error);
	},
});

export const database = new Database({
	adapter,
	modelClasses: [Category, Expense],
});

export const seedCategories = async () => {
	const categoriesCount = await database
		.get<Category>("categories")
		.query()
		.fetchCount();
	if (categoriesCount === 0) {
		await database.write(async () => {
			const initialCategories = [
				{ name: "Comida", icon: "fast-food" },
				{ name: "Transporte", icon: "car" },
				{ name: "Hogar", icon: "home" },
				{ name: "Salud", icon: "medkit" },
				{ name: "Ocio", icon: "game-controller" },
				{ name: "Educación", icon: "book" },
				{ name: "Otros", icon: "cart" },
			];

			const categoryCollection = database.get<Category>("categories");
			for (const cat of initialCategories) {
				await categoryCollection.create((category) => {
					category.name = cat.name;
					category.icon = cat.icon;
				});
			}
		});
	}
};
