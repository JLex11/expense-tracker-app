import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export async function exportExpensesCSV() {
	try {
		const expenses = await database.get<Expense>("expenses").query().fetch();
		const categories = await database
			.get<Category>("categories")
			.query()
			.fetch();
		const header = "Date,Amount,Category,Payment Method,Note\n";
		const rows = expenses
			.map((exp) => {
				const cat = categories.find((c) => c.id === exp.categoryId);
				return `${new Date(exp.date).toLocaleString()},${exp.amount},${cat?.name || "Unknown"},${exp.paymentMethod},"${(exp.note || "").replace(/"/g, '""')}"`;
			})
			.join("\n");

		const file = new FileSystem.File(
			FileSystem.Paths.document,
			"expenses_export.csv",
		);
		file.write(header + rows);

		if (await Sharing.isAvailableAsync()) {
			await Sharing.shareAsync(file.uri);
		} else {
			Alert.alert(
				"No disponible",
				"No se puede compartir archivos en este dispositivo.",
			);
		}
	} catch (error) {
		Alert.alert("Error", "No se pudo exportar el CSV. Intenta de nuevo.");
		console.error(error);
	}
}
