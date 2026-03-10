import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { database } from "@/database";
import type Budget from "@/database/models/Budget";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import type RecurringExpenseRule from "@/database/models/RecurringExpenseRule";
import { loadPrefs, savePrefs } from "@/hooks/usePrefs";
import { translate } from "@/utils/i18n";

const BACKUP_FILE_NAME = "expense-tracker-backup.json";
const BACKUP_VERSION = 1;

type BackupPayload = {
	version: number;
	exportedAt: number;
	prefs: ReturnType<typeof loadPrefs>;
	categories: Array<{ id: string; name: string; icon: string; createdAt: number; updatedAt: number }>;
	expenses: Array<{
		id: string;
		amount: number;
		categoryId: string;
		date: number;
		note: string | null;
		paymentMethod: string;
		status: string;
		origin: string;
		recurringRuleId: string | null;
		resolvedAt: number | null;
		createdAt: number;
		updatedAt: number;
	}>;
	recurringRules: Array<{
		id: string;
		amount: number;
		categoryId: string;
		paymentMethod: string;
		note: string | null;
		intervalValue: number;
		intervalUnit: string;
		startDate: number;
		nextDueAt: number;
		isActive: boolean;
		createdAt: number;
		updatedAt: number;
	}>;
	budgets: Array<{
		id: string;
		categoryId: string;
		monthKey: string;
		limitAmount: number;
		createdAt: number;
		updatedAt: number;
	}>;
};

function setRawIdentity(
	record: { _raw: Record<string, string | number | null> },
	input: { id: string; createdAt: number; updatedAt: number },
) {
	record._raw.id = input.id;
	record._raw.created_at = input.createdAt;
	record._raw.updated_at = input.updatedAt;
}

function t(key: string, params?: Record<string, string | number>) {
	return translate(loadPrefs().language, key, params);
}

async function loadDocumentPicker() {
	try {
		return await import("expo-document-picker");
	} catch (error) {
		console.error(error);
		Alert.alert(
			t("importBackup"),
			t("importUnavailable"),
		);
		return null;
	}
}

export async function exportAppBackup() {
	try {
		const [categories, expenses, recurringRules, budgets] = await Promise.all([
			database.get<Category>("categories").query().fetch(),
			database.get<Expense>("expenses").query().fetch(),
			database
				.get<RecurringExpenseRule>("recurring_expense_rules")
				.query()
				.fetch(),
			database.get<Budget>("budgets").query().fetch(),
		]);

		const payload: BackupPayload = {
			version: BACKUP_VERSION,
			exportedAt: Date.now(),
			prefs: loadPrefs(),
			categories: categories.map((item) => ({
				id: item.id,
				name: item.name,
				icon: item.icon,
				createdAt: item.createdAt.getTime(),
				updatedAt: item.updatedAt.getTime(),
			})),
			expenses: expenses.map((item) => ({
				id: item.id,
				amount: item.amount,
				categoryId: item.categoryId,
				date: item.date,
				note: item.note,
				paymentMethod: item.paymentMethod,
				status: item.status,
				origin: item.origin,
				recurringRuleId: item.recurringRuleId,
				resolvedAt: item.resolvedAt,
				createdAt: item.createdAt.getTime(),
				updatedAt: item.updatedAt.getTime(),
			})),
			recurringRules: recurringRules.map((item) => ({
				id: item.id,
				amount: item.amount,
				categoryId: item.categoryId,
				paymentMethod: item.paymentMethod,
				note: item.note,
				intervalValue: item.intervalValue,
				intervalUnit: item.intervalUnit,
				startDate: item.startDate,
				nextDueAt: item.nextDueAt,
				isActive: item.isActive,
				createdAt: item.createdAt.getTime(),
				updatedAt: item.updatedAt.getTime(),
			})),
			budgets: budgets.map((item) => ({
				id: item.id,
				categoryId: item.categoryId,
				monthKey: item.monthKey,
				limitAmount: item.limitAmount,
				createdAt: item.createdAt.getTime(),
				updatedAt: item.updatedAt.getTime(),
			})),
		};

		const file = new FileSystem.File(FileSystem.Paths.document, BACKUP_FILE_NAME);
		file.write(JSON.stringify(payload, null, 2));

		if (await Sharing.isAvailableAsync()) {
			await Sharing.shareAsync(file.uri);
			return;
		}

		Alert.alert(t("backupSaved"), t("backupStoredAt", { uri: file.uri }));
	} catch (error) {
		console.error(error);
		Alert.alert(t("error"), t("couldNotExportBackup"));
	}
}

export async function importAppBackup() {
	try {
		const DocumentPicker = await loadDocumentPicker();
		if (!DocumentPicker) {
			return false;
		}

		const result = await DocumentPicker.getDocumentAsync({
			type: "application/json",
			copyToCacheDirectory: true,
			multiple: false,
		});

		if (result.canceled || !result.assets[0]) {
			return false;
		}

		const backupFile = new FileSystem.File(result.assets[0].uri);
		const payload = JSON.parse(await backupFile.text()) as BackupPayload;

		if (payload.version !== BACKUP_VERSION) {
			throw new Error(t("unsupportedBackupVersion"));
		}

		await database.unsafeResetDatabase();

		await database.write(async () => {
			const categoriesCollection = database.get<Category>("categories");
			const recurringRulesCollection = database.get<RecurringExpenseRule>(
				"recurring_expense_rules",
			);
			const expensesCollection = database.get<Expense>("expenses");
			const budgetsCollection = database.get<Budget>("budgets");

			for (const item of payload.categories) {
				await categoriesCollection.create((draft) => {
					setRawIdentity(draft as any, item);
					draft.name = item.name;
					draft.icon = item.icon;
				});
			}

			for (const item of payload.recurringRules) {
				await recurringRulesCollection.create((draft) => {
					setRawIdentity(draft as any, item);
					draft.amount = item.amount;
					draft.categoryId = item.categoryId;
					draft.paymentMethod = item.paymentMethod;
					draft.note = item.note;
					draft.intervalValue = item.intervalValue;
					draft.intervalUnit = item.intervalUnit as any;
					draft.startDate = item.startDate;
					draft.nextDueAt = item.nextDueAt;
					draft.isActive = item.isActive;
				});
			}

			for (const item of payload.expenses) {
				await expensesCollection.create((draft) => {
					setRawIdentity(draft as any, item);
					draft.amount = item.amount;
					draft.categoryId = item.categoryId;
					draft.date = item.date;
					draft.note = item.note;
					draft.paymentMethod = item.paymentMethod;
					draft.status = item.status as any;
					draft.origin = item.origin as any;
					draft.recurringRuleId = item.recurringRuleId;
					draft.resolvedAt = item.resolvedAt;
				});
			}

			for (const item of payload.budgets) {
				await budgetsCollection.create((draft) => {
					setRawIdentity(draft as any, item);
					draft.categoryId = item.categoryId;
					draft.monthKey = item.monthKey;
					draft.limitAmount = item.limitAmount;
				});
			}
		});

		savePrefs(payload.prefs);
		return true;
	} catch (error) {
		console.error(error);
		Alert.alert(t("error"), t("couldNotImportBackup"));
		return false;
	}
}
