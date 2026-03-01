import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import { useExpenses } from "@/hooks/useExpenses";
import { usePendingRecurringExpenses } from "@/hooks/usePendingRecurringExpenses";
import { useRecurringExpenseRules } from "@/hooks/useRecurringExpenseRules";
import {
	confirmPendingExpense,
	skipPendingExpense,
} from "@/services/expenses";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { formatRecurrenceSummary } from "@/utils/recurrence";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilterType = "today" | "week" | "month" | "custom";
const FILTERS: { key: FilterType; label: string }[] = [
	{ key: "today", label: "Today" },
	{ key: "week", label: "This Week" },
	{ key: "month", label: "This Month" },
	{ key: "custom", label: "Custom" },
];

export default function HistoryScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const expenses = useExpenses();
	const pendingExpenses = usePendingRecurringExpenses();
	const recurringRules = useRecurringExpenseRules();
	const [categories, setCategories] = useState<Category[]>([]);
	const [filter, setFilter] = useState<FilterType>("month");
	const [searchQuery, setSearchQuery] = useState("");
	const [resolvingExpenseId, setResolvingExpenseId] = useState<string | null>(
		null,
	);

	React.useEffect(() => {
		database.get<Category>("categories").query().fetch().then(setCategories);
	}, []);

	const categoryMap = useMemo(
		() => new Map(categories.map((category) => [category.id, category])),
		[categories],
	);
	const recurringRuleMap = useMemo(
		() => new Map(recurringRules.map((rule) => [rule.id, rule])),
		[recurringRules],
	);

	const filteredExpenses = useMemo(() => {
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();
		const startOfWeek = new Date(startOfToday);
		startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
		const startOfMonth = new Date(
			now.getFullYear(),
			now.getMonth(),
			1,
		).getTime();

		return expenses
			.filter((exp) => {
				if (searchQuery) {
					const q = searchQuery.toLowerCase();
					const category = categoryMap.get(exp.categoryId);
					if (
						!exp.note?.toLowerCase().includes(q) &&
						!category?.name.toLowerCase().includes(q)
					) {
						return false;
					}
				}
				if (filter === "today") return exp.date >= startOfToday;
				if (filter === "week") return exp.date >= startOfWeek.getTime();
				if (filter === "month") return exp.date >= startOfMonth;
				return true;
			})
			.sort((a, b) => b.date - a.date);
	}, [categoryMap, expenses, filter, searchQuery]);

	const groupedExpenses = useMemo(() => {
		const groups: Record<string, typeof expenses> = {};
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();
		const startOfYesterday = startOfToday - 86400000;

		filteredExpenses.forEach((exp) => {
			let groupName = "";
			if (exp.date >= startOfToday) groupName = "TODAY";
			else if (exp.date >= startOfYesterday) groupName = "YESTERDAY";
			else {
				groupName = new Date(exp.date)
					.toLocaleDateString(undefined, { month: "short", day: "numeric" })
					.toUpperCase();
			}

			if (!groups[groupName]) groups[groupName] = [];
			groups[groupName].push(exp);
		});

		return groups;
	}, [filteredExpenses]);

	const handleDelete = (id: string) => {
		Alert.alert(
			"Delete Expense",
			"Are you sure you want to delete this expense?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await database.write(async () => {
								const expense = await database
									.get<Expense>("expenses")
									.find(id);
								await expense.destroyPermanently();
							});
						} catch (e) {
							console.error(e);
						}
					},
				},
			],
		);
	};

	const handleResolvePending = async (
		expenseId: string,
		action: "confirm" | "skip",
	) => {
		setResolvingExpenseId(expenseId);
		try {
			if (action === "confirm") {
				await confirmPendingExpense(expenseId);
			} else {
				await skipPendingExpense(expenseId);
			}
		} catch (error) {
			console.error(error);
			Alert.alert("Error", "No se pudo actualizar este gasto recurrente.");
		} finally {
			setResolvingExpenseId(null);
		}
	};

	return (
		<View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
			<View className="border-b border-gray-100 px-5 pb-3 pt-4">
				<View className="flex-row items-center justify-between">
					<Text className="text-2xl font-bold text-gray-900">
						Expense History
					</Text>
					<TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full bg-blue-50">
						<Ionicons name="add" size={24} color="#3b82f6" />
					</TouchableOpacity>
				</View>

				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerClassName="mb-3 mt-4 flex-row gap-2"
				>
					{FILTERS.map((f) => {
						const isActive = filter === f.key;
						return (
							<TouchableOpacity
								key={f.key}
								onPress={() => setFilter(f.key)}
								className={`rounded-full px-4 py-2 ${isActive ? "bg-blue-500" : "bg-gray-100"}`}
							>
								<Text
									className={`font-medium capitalize ${isActive ? "text-white" : "text-gray-500"}`}
								>
									{f.label}
								</Text>
							</TouchableOpacity>
						);
					})}
				</ScrollView>

				<View className="flex-row items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
					<Ionicons name="search" size={20} color="#9ca3af" />
					<TextInput
						className="flex-1 font-medium text-gray-800"
						placeholder="Search by notes or category..."
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
			</View>

			<ScrollView contentContainerClassName="pb-24">
				{pendingExpenses.length > 0 ? (
					<View className="mt-6 px-5">
						<View className="mb-4 flex-row items-end justify-between">
							<View>
								<Text className="text-[12px] font-bold uppercase tracking-[2px] text-amber-500">
									Pendientes recurrentes
								</Text>
								<Text className="mt-1 text-sm text-gray-500">
									Confirma si realmente hiciste estos gastos programados.
								</Text>
							</View>
							<View className="rounded-full bg-amber-100 px-3 py-1">
								<Text className="text-xs font-bold text-amber-700">
									{pendingExpenses.length}
								</Text>
							</View>
						</View>

						<View className="gap-3">
							{pendingExpenses.map((expense) => {
								const category = categoryMap.get(expense.categoryId);
								const recurringRule = expense.recurringRuleId
									? recurringRuleMap.get(expense.recurringRuleId)
									: null;
								const recurrenceLabel = recurringRule
									? formatRecurrenceSummary(
											recurringRule.intervalValue,
											recurringRule.intervalUnit,
										)
									: "Recurrente";
								const isResolving = resolvingExpenseId === expense.id;

								return (
									<View
										key={expense.id}
										className="rounded-3xl border border-amber-200 bg-amber-50 p-4"
									>
										<TouchableOpacity
											onPress={() =>
												router.push({
													pathname: "/movement/[id]",
													params: { id: expense.id },
												})
											}
											activeOpacity={0.85}
										>
											<View className="flex-row items-start gap-3">
												<View className="mt-0.5 h-12 w-12 items-center justify-center rounded-2xl bg-white">
													<Ionicons
														name={
															(category?.icon ||
																"help-circle") as keyof typeof Ionicons.glyphMap
														}
														size={24}
														color="#f59e0b"
													/>
												</View>
												<View className="flex-1">
													<View className="flex-row items-start justify-between gap-3">
														<View className="flex-1">
															<Text className="text-base font-bold text-gray-900">
																{category?.name || "Unknown"}
															</Text>
															<Text className="mt-1 text-sm font-medium text-amber-700">
																{recurrenceLabel}
															</Text>
														</View>
														<Text className="text-lg font-bold text-gray-900">
															-${expense.amount.toFixed(2)}
														</Text>
													</View>
													<Text className="mt-3 text-sm text-gray-600">
														Programado para{" "}
														{new Date(expense.date).toLocaleDateString()}
													</Text>
													<Text className="mt-1 text-sm text-gray-500">
														{expense.note?.trim()
															? expense.note
															: "Sin nota para este gasto recurrente."}
													</Text>
												</View>
											</View>
										</TouchableOpacity>

										<View className="mt-4 flex-row gap-3">
											<TouchableOpacity
												onPress={() =>
													void handleResolvePending(expense.id, "confirm")
												}
												disabled={isResolving}
												className="flex-1 items-center rounded-2xl bg-primary py-3"
											>
												<Text className="font-bold text-white">
													{isResolving ? "Guardando..." : "Sí, lo gasté"}
												</Text>
											</TouchableOpacity>
											<TouchableOpacity
												onPress={() =>
													void handleResolvePending(expense.id, "skip")
												}
												disabled={isResolving}
												className="flex-1 items-center rounded-2xl border border-amber-300 bg-white py-3"
											>
												<Text className="font-semibold text-amber-800">
													No
												</Text>
											</TouchableOpacity>
										</View>
									</View>
								);
							})}
						</View>
					</View>
				) : null}

				{Object.entries(groupedExpenses).map(([groupName, exps]) => (
					<View key={groupName} className="mt-6 px-5">
						<Text className="mb-3 text-[12px] font-bold tracking-[2px] text-gray-400">
							{groupName}
						</Text>
						<View className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
							{exps.map((exp, index) => {
								const category = categoryMap.get(exp.categoryId);
								const isLast = index === exps.length - 1;
								const timeText = new Date(exp.date).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								});

								return (
									<TouchableOpacity
										key={exp.id}
										onPress={() =>
											router.push({
												pathname: "/movement/[id]",
												params: { id: exp.id },
											})
										}
										onLongPress={() => handleDelete(exp.id)}
										delayLongPress={500}
										className={`flex-row items-center bg-white p-4 ${!isLast ? "border-b border-gray-100" : ""}`}
									>
										<View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-orange-50">
											<Ionicons
												name={
													(category?.icon ||
														"help-circle") as keyof typeof Ionicons.glyphMap
												}
												size={24}
												color="#f59e0b"
											/>
										</View>

										<View className="flex-1">
											<Text className="mb-1 font-bold text-gray-900">
												{category?.name || "Unknown"}
											</Text>
											<Text numberOfLines={1} className="text-xs text-gray-400">
												{exp.note || "No notes"}
											</Text>
										</View>

										<View className="items-end">
											<Text className="mb-1 font-bold text-gray-900">
												-${exp.amount.toFixed(2)}
											</Text>
											<Text className="text-xs text-gray-400">{timeText}</Text>
										</View>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
				))}

				{filteredExpenses.length === 0 ? (
					<View className="items-center justify-center px-10 py-20">
						<View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-50">
							<Ionicons name="receipt-outline" size={40} color="#d1d5db" />
						</View>
						<Text className="text-center text-lg font-medium text-gray-500">
							No expenses found
						</Text>
						<Text className="mt-2 text-center text-gray-400">
							Try adjusting your filters or search query.
						</Text>
					</View>
				) : null}
			</ScrollView>
		</View>
	);
}
