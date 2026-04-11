import { database } from "@/database";
import type Expense from "@/database/models/Expense";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useExpenses } from "@/hooks/useExpenses";
import { useI18n } from "@/hooks/useI18n";
import { usePrefsSelector } from "@/hooks/usePrefs";
import { deleteBudget, upsertBudget } from "@/services/budgets";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import {
    formatMonthLabel,
    getMonthBounds,
    getMonthKey,
    shiftMonthKey,
} from "@/utils/months";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilterType = "today" | "week" | "month" | "custom";

type BudgetSummaryRow = {
	budget: {
		id: string;
		categoryId: string;
		limitAmount: number;
	};
	category?: {
		name: string;
		icon?: string | null;
	};
	spent: number;
	remaining: number;
	progress: number;
	isOverBudget: boolean;
};

type BudgetSectionItem =
	| { kind: "budget"; row: BudgetSummaryRow }
	| { kind: "empty-budget" };

type HistoryControlsItem = { kind: "history-controls-placeholder" };

type HistoryGroupSection = {
	key: string;
	title: string;
	type: "history";
	data: Expense[];
};

type BudgetSection = {
	key: "budget-section";
	type: "budget";
	data: BudgetSectionItem[];
};

type HistoryControlsSection = {
	key: "history-controls";
	type: "history-controls";
	data: HistoryControlsItem[];
};

type ScreenSection = BudgetSection | HistoryControlsSection | HistoryGroupSection;
type ScreenItem = BudgetSectionItem | Expense | HistoryControlsItem;

function normalizeHistoryFilter(
	value: string | string[] | undefined,
): FilterType {
	const raw = Array.isArray(value) ? value[0] : value;
	if (
		raw === "today" ||
		raw === "week" ||
		raw === "month" ||
		raw === "custom"
	) {
		return raw;
	}
	return "month";
}

function normalizeSearch(value: string | string[] | undefined): string {
	const raw = Array.isArray(value) ? value[0] : value;
	return typeof raw === "string" ? raw : "";
}

function getHistoryStartOfWeek(now: Date, weekStart: "Sunday" | "Monday") {
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const weekStartIndex = weekStart === "Monday" ? 1 : 0;
	const startOfWeek = new Date(startOfToday);
	const daysSinceStart = (now.getDay() - weekStartIndex + 7) % 7;
	startOfWeek.setDate(startOfWeek.getDate() - daysSinceStart);
	return startOfWeek.getTime();
}

function formatHistoryGroup(
	dateMs: number,
	locale: string,
	todayLabel: string,
	yesterdayLabel: string,
) {
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const startOfYesterday = startOfToday - 86400000;

	if (dateMs >= startOfToday) return todayLabel;
	if (dateMs >= startOfYesterday) return yesterdayLabel;

	return new Date(dateMs)
		.toLocaleDateString(locale, { month: "short", day: "numeric" })
		.toUpperCase();
}

export default function BudgetScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { filter: filterParam, search: searchParam } = useLocalSearchParams<{
		filter?: string | string[];
		search?: string | string[];
	}>();
	const currency = usePrefsSelector((prefs) => prefs.currency);
	const weekStart = usePrefsSelector((prefs) => prefs.weekStart);
	const { t, language, locale } = useI18n();
	const expenses = useExpenses();
	const categories = useCategories();

	const [filter, setFilter] = useState<FilterType>(() =>
		normalizeHistoryFilter(filterParam),
	);
	const [searchQuery, setSearchQuery] = useState(() =>
		normalizeSearch(searchParam),
	);
	const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
		getMonthKey(Date.now()),
	);
	const [budgetModalVisible, setBudgetModalVisible] = useState(false);
	const [budgetCategoryId, setBudgetCategoryId] = useState<string | null>(null);
	const [budgetAmount, setBudgetAmount] = useState("");
	const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
	const [customStartDate, setCustomStartDate] = useState(() => {
		const date = new Date();
		date.setDate(date.getDate() - 30);
		return date;
	});
	const [customEndDate, setCustomEndDate] = useState(() => new Date());
	const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
	const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);
	const deferredSearchQuery = useDeferredValue(searchQuery);

	const budgets = useBudgets(selectedMonthKey);
	const filters = useMemo(
		() => [
			{ key: "today" as const, label: t("filterToday") },
			{ key: "week" as const, label: t("filterWeek") },
			{ key: "month" as const, label: t("filterMonth") },
			{ key: "custom" as const, label: t("filterCustom") },
		],
		[t],
	);

	useEffect(() => {
		setFilter((current) => {
			const next = normalizeHistoryFilter(filterParam);
			return current === next ? current : next;
		});
	}, [filterParam]);

	useEffect(() => {
		setSearchQuery((current) => {
			const next = normalizeSearch(searchParam);
			return current === next ? current : next;
		});
	}, [searchParam]);

	const categoryMap = useMemo(
		() => new Map(categories.map((category) => [category.id, category])),
		[categories],
	);

	const budgetSummary = useMemo(() => {
		const monthBounds = getMonthBounds(selectedMonthKey);
		const spentByCategory = new Map<string, number>();

		for (const expense of expenses) {
			if (expense.date < monthBounds.start || expense.date >= monthBounds.end) {
				continue;
			}

			spentByCategory.set(
				expense.categoryId,
				(spentByCategory.get(expense.categoryId) || 0) +
					Math.abs(expense.amount),
			);
		}

		const rows = budgets.map((budget) => {
			const spent = spentByCategory.get(budget.categoryId) || 0;
			const limit = budget.limitAmount;
			const remaining = limit - spent;
			const progress = limit > 0 ? Math.min(spent / limit, 1) : 0;
			return {
				budget,
				category: categoryMap.get(budget.categoryId),
				spent,
				remaining,
				progress,
				isOverBudget: spent > limit,
			};
		});

		let totalBudgeted = 0;
		let totalSpent = 0;
		for (const row of rows) {
			totalBudgeted += row.budget.limitAmount;
			totalSpent += row.spent;
		}

		return {
			rows,
			totalBudgeted,
			totalSpent,
		};
	}, [budgets, categoryMap, expenses, selectedMonthKey]);

	const filteredExpenses = useMemo(() => {
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();
		const startOfWeek = getHistoryStartOfWeek(now, weekStart);
		const startOfMonth = new Date(
			now.getFullYear(),
			now.getMonth(),
			1,
		).getTime();
		const endOfCustomRange = new Date(
			customEndDate.getFullYear(),
			customEndDate.getMonth(),
			customEndDate.getDate() + 1,
		).getTime();
		const startOfCustomRange = new Date(
			customStartDate.getFullYear(),
			customStartDate.getMonth(),
			customStartDate.getDate(),
		).getTime();
		const query = deferredSearchQuery.trim().toLowerCase();

		return expenses
			.filter((expense) => {
				if (query) {
					const category = categoryMap.get(expense.categoryId);
					if (
						!expense.note?.toLowerCase().includes(query) &&
						!category?.name.toLowerCase().includes(query)
					) {
						return false;
					}
				}

				if (filter === "today") return expense.date >= startOfToday;
				if (filter === "week") return expense.date >= startOfWeek;
				if (filter === "month") return expense.date >= startOfMonth;

				return (
					expense.date >= startOfCustomRange && expense.date < endOfCustomRange
				);
			})
			.sort((a, b) => b.date - a.date);
	}, [
		categoryMap,
		customEndDate,
		customStartDate,
		expenses,
		filter,
		deferredSearchQuery,
		weekStart,
	]);

	const budgetSectionItems = useMemo<BudgetSectionItem[]>(
		() =>
			budgetSummary.rows.length > 0
				? budgetSummary.rows.map((row) => ({ kind: "budget" as const, row }))
				: [{ kind: "empty-budget" as const }],
		[budgetSummary.rows],
	);

	const historySections = useMemo<HistoryGroupSection[]>(() => {
		const groups = new Map<string, Expense[]>();
		const todayLabel = language === "es" ? "HOY" : "TODAY";
		const yesterdayLabel = language === "es" ? "AYER" : "YESTERDAY";

		for (const expense of filteredExpenses) {
			const key = formatHistoryGroup(
				expense.date,
				locale,
				todayLabel,
				yesterdayLabel,
			);
			const group = groups.get(key);
			if (group) {
				group.push(expense);
			} else {
				groups.set(key, [expense]);
			}
		}

		return Array.from(groups.entries()).map(([title, data]) => ({
			key: title,
			title,
			type: "history" as const,
			data,
		}));
	}, [filteredExpenses, language, locale]);

	const sections = useMemo<ScreenSection[]>(() => {
		return [
			{
				key: "budget-section",
				type: "budget",
				data: budgetSectionItems,
			},
			{
				key: "history-controls",
				type: "history-controls",
				data: [{ kind: "history-controls-placeholder" }],
			},
			...historySections,
		];
	}, [budgetSectionItems, historySections]);

	const openCreateBudget = () => {
		setEditingBudgetId(null);
		setBudgetAmount("");
		setBudgetCategoryId(categories[0]?.id ?? null);
		setBudgetModalVisible(true);
	};

	const openEditBudget = (budgetId: string) => {
		const selectedBudget = budgets.find((budget) => budget.id === budgetId);
		if (!selectedBudget) return;
		setEditingBudgetId(selectedBudget.id);
		setBudgetCategoryId(selectedBudget.categoryId);
		setBudgetAmount(String(selectedBudget.limitAmount));
		setBudgetModalVisible(true);
	};

	const closeBudgetModal = () => {
		setBudgetModalVisible(false);
		setEditingBudgetId(null);
		setBudgetAmount("");
		setBudgetCategoryId(null);
	};

	const handleSaveBudget = async () => {
		if (!budgetCategoryId) {
			Alert.alert(t("error"), t("chooseCategoryForBudget"));
			return;
		}

		const parsedAmount = Number.parseFloat(budgetAmount);
		if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
			Alert.alert(t("error"), t("enterBudgetAmountGreaterThanZero"));
			return;
		}

		try {
			await upsertBudget({
				categoryId: budgetCategoryId,
				monthKey: selectedMonthKey,
				limitAmount: parsedAmount,
			});
			closeBudgetModal();
		} catch (error) {
			console.error(error);
			Alert.alert(t("error"), t("couldNotSaveBudget"));
		}
	};

	const handleDeleteBudget = () => {
		if (!editingBudgetId) return;

		Alert.alert(t("deleteBudgetTitle"), t("deleteBudgetBody"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("delete"),
				style: "destructive",
				onPress: async () => {
					try {
						await deleteBudget(editingBudgetId);
						closeBudgetModal();
					} catch (error) {
						console.error(error);
						Alert.alert(t("error"), t("couldNotDeleteBudget"));
					}
				},
			},
		]);
	};

	const handleDeleteExpense = (expenseId: string) => {
		Alert.alert(t("deleteExpense"), t("actionCannotBeUndone"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("delete"),
				style: "destructive",
				onPress: async () => {
					try {
						await database.write(async () => {
							const expense = await database
								.get<Expense>("expenses")
								.find(expenseId);
							await expense.markAsDeleted();
						});
					} catch (error) {
						console.error(error);
						Alert.alert(t("error"), t("couldNotDeleteMovement"));
					}
				},
			},
		]);
	};

	const totalRemaining = budgetSummary.totalBudgeted - budgetSummary.totalSpent;
	const listHeader = (
		<View className="px-5 pb-6 pt-4">
			<View className="flex-row items-center justify-between">
				<View>
					<Text className="text-3xl font-bold text-gray-900">
						{t("budgetTitle")}
					</Text>
					<Text className="mt-1 text-sm text-gray-500">
						{t("budgetSubtitle")}
					</Text>
				</View>
				<TouchableOpacity
					className="h-11 w-11 items-center justify-center rounded-full bg-blue-50"
					onPress={openCreateBudget}
				>
					<Ionicons name="add" size={24} color="#3b82f6" />
				</TouchableOpacity>
			</View>

			<View className="mt-5 rounded-[28px] bg-slate-900 p-5">
				<View className="flex-row items-center justify-between">
					<TouchableOpacity
						className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
						onPress={() =>
							setSelectedMonthKey((current) => shiftMonthKey(current, -1))
						}
					>
						<Ionicons name="chevron-back" size={20} color="#fff" />
					</TouchableOpacity>
					<View className="items-center">
						<Text className="text-xs font-bold uppercase tracking-[2px] text-slate-400">
							{t("budgetMonth")}
						</Text>
						<Text className="mt-1 text-lg font-bold text-white">
							{formatMonthLabel(selectedMonthKey, language)}
						</Text>
					</View>
					<TouchableOpacity
						className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
						onPress={() =>
							setSelectedMonthKey((current) => shiftMonthKey(current, 1))
						}
					>
						<Ionicons name="chevron-forward" size={20} color="#fff" />
					</TouchableOpacity>
				</View>

				<View className="mt-5 flex-row gap-3">
					<View className="flex-1 rounded-2xl bg-white/10 p-4">
						<Text className="text-xs font-semibold uppercase tracking-[1px] text-slate-300">
							{t("planned")}
						</Text>
						<Text className="mt-2 text-xl font-bold text-white">
							{formatCurrency(budgetSummary.totalBudgeted, currency)}
						</Text>
					</View>
					<View className="flex-1 rounded-2xl bg-white/10 p-4">
						<Text className="text-xs font-semibold uppercase tracking-[1px] text-slate-300">
							{t("spent")}
						</Text>
						<Text className="mt-2 text-xl font-bold text-white">
							{formatCurrency(budgetSummary.totalSpent, currency)}
						</Text>
					</View>
				</View>

				<View className="mt-3 rounded-2xl bg-emerald-400/12 p-4">
					<Text className="text-xs font-semibold uppercase tracking-[1px] text-emerald-200">
						{t("remaining")}
					</Text>
					<Text className="mt-2 text-xl font-bold text-white">
						{formatCurrency(totalRemaining, currency)}
					</Text>
				</View>
			</View>
		</View>
	);

	const renderSectionHeader = ({
		section,
	}: {
		section: ScreenSection;
	}) => {
		if (section.type === "budget") {
			return (
				<View className="mt-6 px-5">
					<View className="mb-3 flex-row items-center justify-between">
						<View className="max-w-[70%]">
							<Text className="text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
								{t("monthlyLimits")}
							</Text>
							<Text className="mt-1 text-sm text-gray-500">
								{t("monthlyLimitsHint")}
							</Text>
						</View>
						<TouchableOpacity onPress={openCreateBudget} className="max-w-25">
							<Text className="text-center font-semibold text-blue-500">
								{t("addBudget")}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			);
		}

		if (section.type === "history-controls") {
			return (
				<View className="mt-6 border-t border-gray-100 bg-white px-5 pb-4 pt-6">
					<Text className="text-2xl font-bold text-gray-900">
						{t("historyTitle")}
					</Text>
					<Text className="mt-1 text-sm text-gray-500">
						{t("historySubtitle")}
					</Text>

					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerClassName="mb-3 mt-4 flex-row gap-2"
					>
						{filters.map((item) => {
							const isActive = filter === item.key;
							return (
								<TouchableOpacity
									key={item.key}
									onPress={() => setFilter(item.key)}
									className={`rounded-full px-4 py-2 ${
										isActive ? "bg-blue-500" : "bg-gray-100"
									}`}
								>
									<Text
										className={`font-medium ${
											isActive ? "text-white" : "text-gray-500"
										}`}
									>
										{item.label}
									</Text>
								</TouchableOpacity>
							);
						})}
					</ScrollView>

					{filter === "custom" ? (
						<View className="mb-3 flex-row gap-3">
							<TouchableOpacity
								className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
								onPress={() => setShowCustomStartPicker(true)}
							>
								<Text className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
									{t("from")}
								</Text>
								<Text className="mt-1 font-semibold text-gray-800">
									{customStartDate.toLocaleDateString(locale)}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
								onPress={() => setShowCustomEndPicker(true)}
							>
								<Text className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
									{t("to")}
								</Text>
								<Text className="mt-1 font-semibold text-gray-800">
									{customEndDate.toLocaleDateString(locale)}
								</Text>
							</TouchableOpacity>
						</View>
					) : null}

					<View className="flex-row items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
						<Ionicons name="search" size={20} color="#9ca3af" />
						<TextInput
							className="flex-1 font-medium text-gray-800"
							placeholder={t("searchByNotesOrCategory")}
							placeholderTextColor="#9ca3af"
							value={searchQuery}
							onChangeText={setSearchQuery}
						/>
						{searchQuery.length > 0 ? (
							<TouchableOpacity onPress={() => setSearchQuery("")}>
								<Ionicons name="close-circle" size={20} color="#9ca3af" />
							</TouchableOpacity>
						) : null}
					</View>

					{filteredExpenses.length === 0 ? (
						<View className="items-center justify-center px-10 py-20">
							<View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-50">
								<Ionicons
									name="receipt-outline"
									size={40}
									color="#d1d5db"
								/>
							</View>
							<Text className="text-center text-lg font-medium text-gray-500">
								{t("noExpensesFound")}
							</Text>
							<Text className="mt-2 text-center text-gray-400">
								{t("adjustFiltersHint")}
							</Text>
						</View>
					) : null}
				</View>
			);
		}

		return (
			<View className="mt-6 px-5">
				<Text className="mb-3 text-[12px] font-bold tracking-[2px] text-gray-400">
					{section.title}
				</Text>
			</View>
		);
	};

	const renderItem = ({
		item,
		section,
		index,
	}: {
		item: ScreenItem;
		section: ScreenSection;
		index: number;
	}) => {
		if (section.type === "history-controls") {
			return null;
		}

		if (section.type === "budget") {
			if ("kind" in item && item.kind === "empty-budget") {
				return (
					<View className="mx-5 items-center rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-10">
						<View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-50">
							<Ionicons
								name="pie-chart-outline"
								size={28}
								color="#3b82f6"
							/>
						</View>
						<Text className="text-center text-lg font-bold text-gray-900">
							{t("noBudgetsYet")}
						</Text>
						<Text className="mt-2 text-center text-gray-500">
							{t("noBudgetsYetBody")}
						</Text>
						<TouchableOpacity
							className="mt-5 rounded-2xl bg-primary px-5 py-3"
							onPress={openCreateBudget}
						>
							<Text className="font-bold text-white">
								{t("createFirstBudget")}
							</Text>
						</TouchableOpacity>
					</View>
				);
			}

			if (!("kind" in item) || item.kind !== "budget") {
				return null;
			}

			const row = item.row;

			return (
				<View className="mx-5 mb-3">
					<TouchableOpacity
						onPress={() => openEditBudget(row.budget.id)}
						className="rounded-3xl border border-gray-100 bg-white p-4"
						activeOpacity={0.85}
					>
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center gap-3">
								<View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
									<Ionicons
										name={
											(row.category?.icon ||
												"wallet-outline") as keyof typeof Ionicons.glyphMap
										}
										size={22}
										color="#3b82f6"
									/>
								</View>
								<View>
									<Text className="font-bold text-gray-900">
										{row.category?.name || t("unknown")}
									</Text>
									<Text className="mt-1 text-sm text-gray-500">
										{formatCurrency(row.spent, currency)}{" "}
										{language === "es" ? "de" : "of"}{" "}
										{formatCurrency(row.budget.limitAmount, currency)}
									</Text>
								</View>
							</View>

							<View
								className={`rounded-full px-3 py-1 ${
									row.isOverBudget ? "bg-red-50" : "bg-emerald-50"
								}`}
							>
								<Text
									className={`text-xs font-bold ${
										row.isOverBudget ? "text-red-600" : "text-emerald-600"
									}`}
								>
									{row.isOverBudget ? t("over") : t("onTrack")}
								</Text>
							</View>
						</View>

						<View className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
							<View
								className={`h-full rounded-full ${
									row.isOverBudget ? "bg-red-500" : "bg-primary"
								}`}
								style={{
									width: `${Math.min(row.progress * 100, 100)}%`,
								}}
							/>
						</View>

						<Text className="mt-3 text-sm text-gray-500">
							{row.isOverBudget
								? t("overBudgetAmount", {
										amount: formatCurrency(Math.abs(row.remaining), currency),
									})
								: t("leftAmount", {
										amount: formatCurrency(row.remaining, currency),
									})}
						</Text>
					</TouchableOpacity>
				</View>
			);
		}

		const expense = item as Expense;
		const category = categoryMap.get(expense.categoryId);
		const isLast = index === section.data.length - 1;
		const timeText = new Date(expense.date).toLocaleTimeString(locale, {
			hour: "2-digit",
			minute: "2-digit",
		});

		return (
			<View className="px-5">
				<TouchableOpacity
					onPress={() =>
						router.push({
							pathname: "/movement/[id]",
							params: { id: expense.id },
						})
					}
					onLongPress={() => handleDeleteExpense(expense.id)}
					delayLongPress={500}
					className={`flex-row items-center bg-white p-4 ${
						index === 0 ? "rounded-t-3xl border-t border-x border-gray-100" : ""
					} ${
						isLast ? "rounded-b-3xl border-b border-x border-gray-100" : ""
					} ${!isLast && index > 0 ? "border-x border-gray-100" : ""} ${
						!isLast ? "border-b border-gray-100" : ""
					}`}
				>
					<View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-orange-50">
						<Ionicons
							name={
								(category?.icon || "help-circle") as keyof typeof Ionicons.glyphMap
							}
							size={24}
							color="#f59e0b"
						/>
					</View>

					<View className="flex-1">
						<Text className="mb-1 font-bold text-gray-900">
							{category?.name || t("unknown")}
						</Text>
						<Text numberOfLines={1} className="text-xs text-gray-400">
							{expense.note || t("noNotes")}
						</Text>
					</View>

					<View className="items-end">
						<Text className="mb-1 font-bold text-gray-900">
							{formatCurrency(-expense.amount, currency)}
						</Text>
						<Text className="text-xs text-gray-400">{timeText}</Text>
					</View>
				</TouchableOpacity>
			</View>
		);
	};

	const keyExtractor = (item: ScreenItem, index: number) => {
		if ("kind" in item) {
			if (item.kind === "budget") {
				return item.row.budget.id;
			}

			return `placeholder-${index}`;
		}

		return item.id;
	};

	return (
		<View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
			<Modal
				visible={budgetModalVisible}
				animationType="slide"
				transparent
				onRequestClose={closeBudgetModal}
			>
				<View className="flex-1 justify-end bg-black/40">
					<View className="rounded-t-[28px] bg-white px-6 pb-10 pt-6">
						<Text className="mb-5 text-center text-lg font-bold text-gray-900">
							{editingBudgetId ? t("editBudget") : t("newBudget")}
						</Text>

						<Text className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
							{t("category")}
						</Text>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerClassName="mb-5 flex-row gap-2"
						>
							{categories.map((category) => {
								const isSelected = category.id === budgetCategoryId;
								return (
									<TouchableOpacity
										key={category.id}
										onPress={() => setBudgetCategoryId(category.id)}
										className={`rounded-2xl border px-4 py-3 ${
											isSelected
												? "border-primary bg-primary"
												: "border-gray-200 bg-gray-50"
										}`}
									>
										<Text
											className={`font-semibold ${isSelected ? "text-white" : "text-gray-700"}`}
										>
											{category.name}
										</Text>
									</TouchableOpacity>
								);
							})}
						</ScrollView>

						<Text className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
							{t("monthlyLimit")}
						</Text>
						<View className="mb-6 flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
							<Text className="mr-3 text-xl font-bold text-gray-800">
								{getCurrencySymbol(currency)}
							</Text>
							<TextInput
								className="flex-1 text-lg font-semibold text-gray-900"
								value={budgetAmount}
								onChangeText={setBudgetAmount}
								keyboardType="decimal-pad"
								placeholder="0.00"
								placeholderTextColor="#9ca3af"
							/>
						</View>

						<View className="flex-row gap-3">
							<TouchableOpacity
								className="flex-1 items-center rounded-2xl border border-gray-200 py-3.5"
								onPress={closeBudgetModal}
							>
								<Text className="font-semibold text-gray-500">
									{t("cancel")}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 items-center rounded-2xl bg-primary py-3.5"
								onPress={() => void handleSaveBudget()}
							>
								<Text className="font-bold text-white">{t("save")}</Text>
							</TouchableOpacity>
						</View>

						{editingBudgetId ? (
							<TouchableOpacity
								className="mt-4 items-center rounded-2xl bg-red-50 py-3.5"
								onPress={handleDeleteBudget}
							>
								<Text className="font-bold text-red-600">
									{t("deleteBudgetTitle")}
								</Text>
							</TouchableOpacity>
						) : null}
					</View>
				</View>
			</Modal>

			{showCustomStartPicker ? (
				<DateTimePicker
					value={customStartDate}
					mode="date"
					display={Platform.OS === "ios" ? "spinner" : "default"}
					onChange={(_event, value) => {
						setShowCustomStartPicker(false);
						if (value) {
							setCustomStartDate(value);
							if (value > customEndDate) {
								setCustomEndDate(value);
							}
						}
					}}
				/>
			) : null}

			{showCustomEndPicker ? (
				<DateTimePicker
					value={customEndDate}
					mode="date"
					display={Platform.OS === "ios" ? "spinner" : "default"}
					onChange={(_event, value) => {
						setShowCustomEndPicker(false);
						if (value) {
							setCustomEndDate(value);
						}
					}}
				/>
			) : null}

			<SectionList<ScreenItem, ScreenSection>
				sections={sections}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				renderSectionHeader={renderSectionHeader}
				ListHeaderComponent={listHeader}
				stickySectionHeadersEnabled={false}
				contentContainerStyle={{ paddingBottom: 24 }}
				initialNumToRender={12}
				keyboardShouldPersistTaps="handled"
				removeClippedSubviews={Platform.OS === "android"}
				style={{ flex: 1 }}
			/>
		</View>
	);
}
