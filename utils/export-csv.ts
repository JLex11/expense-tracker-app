import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import { loadPrefs } from "@/hooks/usePrefs";
import { translate } from "@/utils/i18n";
import { Q } from "@nozbe/watermelondb";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

function t(key: string) {
	return translate(loadPrefs().language, key);
}

export async function exportExpensesCSV() {
	try {
		const expenses = await database
			.get<Expense>("expenses")
			.query(Q.where("status", "confirmed"))
			.fetch();
		const categories = await database
			.get<Category>("categories")
			.query()
			.fetch();
		const header =
			loadPrefs().language === "es"
				? "Fecha,Monto,Categoría,Método de pago,Nota\n"
				: "Date,Amount,Category,Payment Method,Note\n";
		const rows = expenses
			.sort((a, b) => b.date - a.date)
			.map((exp) => {
				const cat = categories.find((c) => c.id === exp.categoryId);
				return `${new Date(exp.date).toLocaleString()},${exp.amount},${cat?.name || t("unknown")},${exp.paymentMethod},"${(exp.note || "").replace(/"/g, '""')}"`;
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
				t("noShareAvailable"),
				t("noShareAvailableBody"),
			);
		}
	} catch (error) {
		Alert.alert(t("error"), t("couldNotExportCsv"));
		console.error(error);
	}
}
