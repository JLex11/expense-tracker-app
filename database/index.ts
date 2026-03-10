import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import Budget from "./models/Budget";
import Category from "./models/Category";
import Expense from "./models/Expense";
import RecurringExpenseRule from "./models/RecurringExpenseRule";
import { migrations } from "./migrations";
import schema from "./schema";

const databaseSetupError = (error: Error) => {
	console.error("Database setup error:", error);
};

function createAdapter() {
	try {
		return new SQLiteAdapter({
			schema,
			migrations,
			// Prefer the native SQLite adapter when the build exposes WatermelonDB.
			jsi: false,
			onSetUpError: databaseSetupError,
		});
	} catch (error) {
		console.warn(
			"Falling back to LokiJS adapter because WatermelonDB native SQLite is unavailable.",
			error,
		);

		return new LokiJSAdapter({
			dbName: "expense-tracker-app-fallback",
			schema,
			migrations,
			useWebWorker: false,
			useIncrementalIndexedDB: false,
			onSetUpError: databaseSetupError,
		});
	}
}

const adapter = createAdapter();

export const database = new Database({
	adapter,
	modelClasses: [Budget, Category, Expense, RecurringExpenseRule],
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
