import ExpenseForm from "@/components/expense-form";
import RecurrenceEditor from "@/components/recurrence-editor";
import { database } from "@/database";
import type ReceiptScanJob from "@/database/models/ReceiptScanJob";
import { useCategories } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { createExpenseWithOptionalRecurrence } from "@/services/expenses";
import {
	discardReceiptScan,
	getReceiptDraftFromResult,
	markReceiptScanConfirmed,
	parseReceiptScanResult,
} from "@/services/receipt-scans";
import type {
	PaymentMethod,
	RecurrenceUnit,
	RecurringRuleInput,
} from "@/types/expenses";
import { Text, TouchableOpacity, View } from "@/tw";
import { parseRecurrenceInterval } from "@/utils/recurrence";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function normalizeText(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
}

export default function ReceiptScanReviewScreen() {
	const { id } = useLocalSearchParams<{ id?: string | string[] }>();
	const jobId = Array.isArray(id) ? id[0] : id;
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { t, locale } = useI18n();
	const prefs = usePrefs();
	const categories = useCategories();
	const [job, setJob] = useState<ReceiptScanJob | null>(null);
	const [amount, setAmount] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [date, setDate] = useState(new Date());
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
	const [note, setNote] = useState("");
	const [isRecurring, setIsRecurring] = useState(false);
	const [recurrenceIntervalValue, setRecurrenceIntervalValue] = useState("1");
	const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("month");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!jobId) return;
		let active = true;
		database
			.get<ReceiptScanJob>("receipt_scan_jobs")
			.find(jobId)
			.then((record) => {
				if (active) setJob(record);
			})
			.catch(() => {
				if (active) setJob(null);
			});

		return () => {
			active = false;
		};
	}, [jobId]);

	const result = useMemo(() => (job ? parseReceiptScanResult(job) : null), [job]);

	useEffect(() => {
		if (!result) return;
		const draft = getReceiptDraftFromResult(result);
		setAmount(draft.amount);
		setDate(draft.date);
		setNote(draft.note);
		setPaymentMethod(draft.paymentMethod);
	}, [result]);

	useEffect(() => {
		if (!result?.categoryHint || selectedCategory || categories.length === 0) return;
		const hint = normalizeText(result.categoryHint);
		const match = categories.find((category) => {
			const name = normalizeText(category.name);
			return name.includes(hint) || hint.includes(name);
		});
		if (match) setSelectedCategory(match.id);
	}, [categories, result?.categoryHint, selectedCategory]);

	const isFormValid =
		!!amount &&
		!Number.isNaN(Number(amount)) &&
		Number(amount) > 0 &&
		!!selectedCategory &&
		(!isRecurring || !!parseRecurrenceInterval(recurrenceIntervalValue));

	const handleSave = useCallback(async () => {
		if (!job || !jobId) return;
		if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
			Alert.alert(t("error"), t("enterValidAmountGreaterThanZero"));
			return;
		}
		if (!selectedCategory) {
			Alert.alert(t("error"), t("selectCategoryError"));
			return;
		}

		let recurrence: RecurringRuleInput | null = null;
		if (isRecurring) {
			const parsedInterval = parseRecurrenceInterval(recurrenceIntervalValue);
			if (!parsedInterval) {
				Alert.alert(t("error"), t("invalidRecurrenceInterval"));
				return;
			}
			recurrence = { intervalValue: parsedInterval, intervalUnit: recurrenceUnit };
		}

		setIsSaving(true);
		try {
			const { expenseId } = await createExpenseWithOptionalRecurrence({
				amount: Number(amount),
				categoryId: selectedCategory,
				date: date.getTime(),
				note,
				paymentMethod,
				recurrence,
			});
			await markReceiptScanConfirmed(jobId);
			if (expenseId) {
				router.replace({ pathname: "/movement/[id]", params: { id: expenseId } });
			} else {
				router.back();
			}
		} catch (error) {
			console.error(error);
			Alert.alert(t("error"), t("saveExpenseError"));
		} finally {
			setIsSaving(false);
		}
	}, [
		amount,
		date,
		isRecurring,
		job,
		jobId,
		note,
		paymentMethod,
		recurrenceIntervalValue,
		recurrenceUnit,
		router,
		selectedCategory,
		t,
	]);

	if (!job || job.status !== "ready" || !result) {
		return (
			<View className="flex-1 bg-white px-6" style={{ paddingTop: insets.top + 20 }}>
				<TouchableOpacity onPress={() => router.back()} className="mb-10">
					<Ionicons name="chevron-back" size={24} color="#111827" />
				</TouchableOpacity>
				<View className="flex-1 items-center justify-center">
					<Ionicons name="receipt-outline" size={42} color="#9ca3af" />
					<Text className="mt-4 text-center text-base font-semibold text-gray-800">
						{t("receiptScanNoResult")}
					</Text>
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-white" style={{ paddingTop: insets.top + 12 }}>
			<View className="flex-row items-center justify-between px-5 pb-2">
				<TouchableOpacity onPress={() => router.back()} hitSlop={10}>
					<Ionicons name="chevron-back" size={24} color="#111827" />
				</TouchableOpacity>
				<Text className="text-base font-bold text-gray-950">
					{t("receiptScanReview")}
				</Text>
				<TouchableOpacity
					hitSlop={10}
					onPress={() =>
						Alert.alert(t("receiptScanDiscardTitle"), t("receiptScanDiscardBody"), [
							{ text: t("cancel"), style: "cancel" },
							{
								text: t("delete"),
								style: "destructive",
								onPress: async () => {
									await discardReceiptScan(job.id);
									router.replace("/receipts" as any);
								},
							},
						])
					}
				>
					<Ionicons name="trash-outline" size={22} color="#ef4444" />
				</TouchableOpacity>
			</View>

			<ExpenseForm
				mode="create"
				currency={prefs.currency}
				locale={locale}
				extraBottomPadding={insets.bottom + 50}
				labels={{
					amount: t("amount"),
					category: t("category"),
					details: t("details"),
					date: t("date"),
					method: t("method"),
					notePlaceholder: t("addNotePlaceholder"),
					recurringExpense: t("recurringExpense"),
					recurringExpenseHelp: t("recurringExpenseHelp"),
					paymentCash: t("paymentCash"),
					paymentCard: t("paymentCard"),
					paymentTransfer: t("paymentTransfer"),
					saveExpense: t("receiptScanConfirmExpense"),
					saveChanges: t("saveChanges"),
				}}
				categories={categories.map((category) => ({
					id: category.id,
					name: category.name,
					icon: category.icon,
				}))}
				amount={amount}
				onChangeAmount={setAmount}
				selectedCategoryId={selectedCategory}
				onSelectCategory={setSelectedCategory}
				date={date}
				onChangeDate={setDate}
				paymentMethod={paymentMethod}
				onChangePaymentMethod={setPaymentMethod}
				note={note}
				onChangeNote={setNote}
				isRecurring={isRecurring}
				onChangeIsRecurring={setIsRecurring}
				recurrenceEditor={
					<RecurrenceEditor
						intervalValue={recurrenceIntervalValue}
						intervalUnit={recurrenceUnit}
						onChangeIntervalValue={setRecurrenceIntervalValue}
						onChangeIntervalUnit={setRecurrenceUnit}
						helperText={t("recurringExpenseHelperCurrent")}
					/>
				}
				onSubmit={handleSave}
				submitDisabled={isSaving || !isFormValid}
				showRecurringToggle
			/>
		</View>
	);
}
