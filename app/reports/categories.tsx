import { useCategories } from "@/hooks/useCategories";
import { useExpenses } from "@/hooks/useExpenses";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { ScrollView, Text, TouchableOpacity, View } from "@/tw";
import { formatCurrency } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilterType = "week" | "month" | "custom";

function getStartOfWeek(now: Date, weekStart: "Sunday" | "Monday") {
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

export default function CategoriesReportScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { t, locale } = useI18n();
	const prefs = usePrefs();
	const categories = useCategories();
	const expenses = useExpenses();

	const [filter, setFilter] = useState<FilterType>("month");
	const [customStartDate, setCustomStartDate] = useState(() => {
		const date = new Date();
		date.setDate(date.getDate() - 30);
		return date;
	});
	const [customEndDate, setCustomEndDate] = useState(() => new Date());
	const [showStartPicker, setShowStartPicker] = useState(false);
	const [showEndPicker, setShowEndPicker] = useState(false);

	const filters: { key: FilterType; label: string }[] = [
		{ key: "week", label: t("filterWeek") },
		{ key: "month", label: t("filterMonth") },
		{ key: "custom", label: t("filterCustom") },
	];

	const reportRows = useMemo(() => {
		const now = new Date();
		const startOfWeek = getStartOfWeek(now, prefs.weekStart);
		const startOfMonth = new Date(
			now.getFullYear(),
			now.getMonth(),
			1,
		).getTime();
		const startOfCustomRange = new Date(
			customStartDate.getFullYear(),
			customStartDate.getMonth(),
			customStartDate.getDate(),
		).getTime();
		const endOfCustomRange = new Date(
			customEndDate.getFullYear(),
			customEndDate.getMonth(),
			customEndDate.getDate() + 1,
		).getTime();

		const totalsByCategory = new Map<string, number>();
		let grandTotal = 0;

		for (const expense of expenses) {
			const inRange =
				filter === "week"
					? expense.date >= startOfWeek
					: filter === "month"
						? expense.date >= startOfMonth
						: expense.date >= startOfCustomRange &&
							expense.date < endOfCustomRange;

			if (!inRange) continue;

			const amount = Math.abs(expense.amount);
			totalsByCategory.set(
				expense.categoryId,
				(totalsByCategory.get(expense.categoryId) ?? 0) + amount,
			);
			grandTotal += amount;
		}

		const rows = Array.from(totalsByCategory.entries())
			.map(([categoryId, amount]) => {
				const category = categories.find((c) => c.id === categoryId);
				return {
					categoryId,
					name: category?.name ?? t("unknown"),
					icon: category?.icon ?? "help-circle",
					amount,
					percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
				};
			})
			.sort((a, b) => b.amount - a.amount);

		return { rows, grandTotal };
	}, [
		categories,
		expenses,
		filter,
		prefs.weekStart,
		customStartDate,
		customEndDate,
		t,
	]);

	return (
		<View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
			<View className="border-b border-gray-100 bg-white px-5 pb-4 pt-4">
				<View className="flex-row items-center justify-between">
					<TouchableOpacity
						className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
						onPress={() => router.back()}
					>
						<Ionicons name="chevron-back" size={20} color="#374151" />
					</TouchableOpacity>
					<Text className="text-lg font-bold text-gray-900">
						{t("topCategories")}
					</Text>
					<View className="h-10 w-10" />
				</View>

				<View className="mt-4 flex-row gap-2">
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
				</View>

				{filter === "custom" ? (
					<View className="mt-3 flex-row gap-3">
						<TouchableOpacity
							className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
							onPress={() => setShowStartPicker(true)}
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
							onPress={() => setShowEndPicker(true)}
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
			</View>

			{showStartPicker ? (
				<DateTimePicker
					value={customStartDate}
					mode="date"
					display={Platform.OS === "ios" ? "spinner" : "default"}
					onChange={(_event, value) => {
						setShowStartPicker(false);
						if (value) {
							setCustomStartDate(value);
							if (value > customEndDate) {
								setCustomEndDate(value);
							}
						}
					}}
				/>
			) : null}

			{showEndPicker ? (
				<DateTimePicker
					value={customEndDate}
					mode="date"
					display={Platform.OS === "ios" ? "spinner" : "default"}
					onChange={(_event, value) => {
						setShowEndPicker(false);
						if (value) {
							setCustomEndDate(value);
						}
					}}
				/>
			) : null}

			<ScrollView contentContainerClassName="px-5 pb-24 pt-5">
				<View className="mb-4 rounded-3xl bg-slate-900 p-5">
					<Text className="text-xs font-semibold uppercase tracking-[1px] text-slate-300">
						{t("total")}
					</Text>
					<Text className="mt-2 text-2xl font-bold text-white">
						{formatCurrency(reportRows.grandTotal, prefs.currency)}
					</Text>
				</View>

				{reportRows.rows.length === 0 ? (
					<View
						key="categories-empty"
						className="mt-12 items-center rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-10"
					>
						<View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-gray-100">
							<Ionicons name="pie-chart-outline" size={26} color="#9ca3af" />
						</View>
						<Text className="text-center text-lg font-bold text-gray-900">
							{t("noExpensesFound")}
						</Text>
						<Text className="mt-2 text-center text-gray-500">
							{t("adjustFiltersHint")}
						</Text>
					</View>
				) : (
					<View key="categories-list" className="gap-3 will-change-variable">
						{reportRows.rows.map((row) => (
							<View
								key={row.categoryId}
								className="rounded-3xl border border-gray-100 bg-white p-4"
							>
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<View className="h-11 w-11 items-center justify-center rounded-2xl bg-orange-50">
											<Ionicons
												name={row.icon as keyof typeof Ionicons.glyphMap}
												size={22}
												color="#f59e0b"
											/>
										</View>
										<View>
											<Text className="font-bold text-gray-900">
												{row.name}
											</Text>
											<Text className="text-xs text-gray-500">
												{row.percentage.toFixed(1)}%
											</Text>
										</View>
									</View>

									<Text className="font-bold text-gray-900">
										{formatCurrency(row.amount, prefs.currency)}
									</Text>
								</View>

								<View className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
									<View
										className="h-full rounded-full bg-orange-400"
										style={{ width: `${Math.min(row.percentage, 100)}%` }}
									/>
								</View>
							</View>
						))}
					</View>
				)}
			</ScrollView>
		</View>
	);
}
