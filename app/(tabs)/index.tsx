import InfoWidget from "@/components/info-widget";
import InsightsSection from "@/components/insights-section";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useExpenses } from "@/hooks/useExpenses";
import { useHomeInsights } from "@/hooks/useHomeInsights";
import { useI18n } from "@/hooks/useI18n";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingRecurringExpenses } from "@/hooks/usePendingRecurringExpenses";
import { usePrefs } from "@/hooks/usePrefs";
import { ScrollView, Text, TouchableOpacity, View } from "@/tw";
import { formatCurrency } from "@/utils/currency";
import { getMonthKey } from "@/utils/months";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const screenWidth = Dimensions.get("window").width;

type HistoryFilter = "today" | "week" | "month" | "custom";

function getGreeting(hour: number, t: (key: string) => string) {
	if (hour < 12) return t("goodMorning");
	if (hour < 18) return t("goodAfternoon");
	return t("goodEvening");
}

export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const expenses = useExpenses();
	const prefs = usePrefs();
	const categories = useCategories();
	const currentMonthKey = useMemo(() => getMonthKey(new Date()), []);
	const budgets = useBudgets(currentMonthKey);
	const homeInsights = useHomeInsights(
		expenses,
		categories,
		budgets,
		prefs.weekStart,
	);
	const { t, language } = useI18n();
	const { unreadCount } = useNotifications();
	const pendingRecurringExpenses = usePendingRecurringExpenses();
	const pendingRecurringCount = pendingRecurringExpenses.length;
	const hasNoExpenses = expenses.length === 0;

	const { weekTotal, thisWeekData, weekLabels, categoryTotals } = useMemo(() => {
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();

		const weekStartIndex = prefs.weekStart === "Monday" ? 1 : 0;
		const labels =
			weekStartIndex === 1
				? language === "es"
					? ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
					: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
				: language === "es"
					? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
					: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

		const startOfWeek = new Date(startOfToday);
		const daysSinceStart = (now.getDay() - weekStartIndex + 7) % 7;
		startOfWeek.setDate(startOfWeek.getDate() - daysSinceStart);
		const startOfWeekTs = startOfWeek.getTime();

		let week = 0;
		const weekDaysArr = [0, 0, 0, 0, 0, 0, 0];
		const catGraph: Record<string, number> = {};

		expenses.forEach((exp) => {
			if (exp.date < startOfWeekTs) return;

			const expDate = new Date(exp.date);
			const val = Math.abs(exp.amount);
			week += val;

			const weekDayIndex = (expDate.getDay() - weekStartIndex + 7) % 7;
			weekDaysArr[weekDayIndex] += val;
			catGraph[exp.categoryId] = (catGraph[exp.categoryId] || 0) + val;
		});

		const topCats = Object.entries(catGraph)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([id, amount]) => {
				const cat = categories.find((c) => c.id === id);
				return {
					id,
					name: cat?.name || t("unknown"),
					icon: cat?.icon || "help",
					amount,
					percentage: week > 0 ? (amount / week) * 100 : 0,
				};
			});

		return {
			weekTotal: week,
			thisWeekData: weekDaysArr,
			weekLabels: labels,
			categoryTotals: topCats,
		};
	}, [expenses, categories, prefs.weekStart, language, t]);

	const openBudgetHistory = (filter: HistoryFilter, search?: string) => {
		const params: Record<string, string> = { filter };
		if (search) params.search = search;

		router.push({
			pathname: "/(tabs)/budget",
			params,
		});
	};

	const budgetUsage = homeInsights.budgetUsage;
	const budgetRatio = budgetUsage?.ratio ?? 0;
	const budgetPct = Math.round(budgetRatio * 100);
	const isBudgetWarning = budgetRatio >= 0.8;
	const isBudgetOver = budgetRatio >= 1;
	const budgetRemaining = budgetUsage
		? budgetUsage.limit - budgetUsage.spent
		: 0;

	return (
		<ScrollView
			className="flex-1 bg-gray-50"
			contentContainerStyle={{
				paddingTop: insets.top + 20,
				paddingBottom: 100,
			}}
		>
			<View className="mb-6 flex-row items-center justify-between px-5">
				<View className="flex-row items-center">
					<View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-blue-100">
						<Ionicons name="person" size={24} color="#3b82f6" />
					</View>
					<View>
						<Text className="text-gray-500">{t("welcomeBack")}</Text>
						<Text className="text-[20px] font-bold text-gray-900">
							{getGreeting(new Date().getHours(), t)}, {prefs.name}
						</Text>
					</View>
				</View>

				<TouchableOpacity
					className="rounded-full border border-gray-100 bg-white p-2"
					onPress={() => router.push("/notifications")}
					activeOpacity={0.85}
				>
					<View>
						<Ionicons name="notifications-outline" size={24} color="#4b5563" />
						{unreadCount > 0 ? (
							<View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
								<Text className="text-[10px] font-bold text-white">
									{unreadCount > 99 ? "99+" : unreadCount}
								</Text>
							</View>
						) : null}
					</View>
				</TouchableOpacity>
			</View>

			{(pendingRecurringCount > 0 || unreadCount > 0) && (
				<TouchableOpacity
					className="mb-5 mx-5 flex-row items-center rounded-2xl border border-blue-100 bg-blue-50 p-4"
					onPress={() => router.push("/notifications")}
					activeOpacity={0.85}
				>
					<View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-white">
						<Ionicons name="notifications-outline" size={20} color="#2563eb" />
					</View>
					<View className="flex-1">
						<Text className="font-semibold text-blue-800">
							{t("notificationsTitle")}
						</Text>
						<Text className="mt-0.5 text-sm text-blue-700">
							{pendingRecurringCount > 0
								? `${pendingRecurringCount} ${
										pendingRecurringCount === 1
											? t("pendingExpenseLabelOne")
											: t("pendingExpenseLabelMany")
									}`
								: `${unreadCount} ${t("pending")}`}
						</Text>
					</View>
					<Ionicons name="chevron-forward" size={18} color="#2563eb" />
				</TouchableOpacity>
			)}

			<InfoWidget
				todayTotal={homeInsights.todayTotal}
				weekTotal={homeInsights.weekTotal}
				prevWeekTotal={homeInsights.prevWeekTotal}
				onPressToday={() => openBudgetHistory("today")}
				onPressWeek={() =>
					router.push({
						pathname: "/reports/categories",
						params: { filter: "week" },
					})
				}
			/>

			<View className="mb-6">
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerClassName="px-5 gap-3"
				>
					<TouchableOpacity
						className="rounded-2xl bg-white border border-gray-100 px-4 py-3"
						onPress={() => router.push("/(tabs)/transact")}
						activeOpacity={0.85}
					>
						<View className="flex-row items-center">
							<Ionicons name="add-circle-outline" size={18} color="#2563eb" />
							<Text className="ml-2 font-semibold text-gray-800">
								{t("addExpense")}
							</Text>
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="rounded-2xl bg-white border border-gray-100 px-4 py-3"
						onPress={() => router.push("/(tabs)/transact?recurring=1")}
						activeOpacity={0.85}
					>
						<View className="flex-row items-center">
							<Ionicons name="repeat-outline" size={18} color="#2563eb" />
							<Text className="ml-2 font-semibold text-gray-800">
								{t("recurrence")}
							</Text>
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="rounded-2xl bg-white border border-gray-100 px-4 py-3"
						onPress={() => router.push("/(tabs)/budget")}
						activeOpacity={0.85}
					>
						<View className="flex-row items-center">
							<Ionicons name="pie-chart-outline" size={18} color="#2563eb" />
							<Text className="ml-2 font-semibold text-gray-800">
								{t("addBudget")}
							</Text>
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="rounded-2xl bg-white border border-gray-100 px-4 py-3"
						onPress={() => router.push("/reports/categories")}
						activeOpacity={0.85}
					>
						<View className="flex-row items-center">
							<Ionicons name="bar-chart-outline" size={18} color="#2563eb" />
							<Text className="ml-2 font-semibold text-gray-800">
								{t("seeAll")}
							</Text>
						</View>
					</TouchableOpacity>
				</ScrollView>
			</View>

			{budgetUsage ? (
				<TouchableOpacity
					className="mb-6 mx-5 rounded-3xl border border-gray-100 bg-white p-5"
					onPress={() => router.push("/(tabs)/budget")}
					activeOpacity={0.85}
				>
					<View className="mb-2 flex-row items-center justify-between">
						<Text className="font-semibold text-gray-500">{t("budgetTitle")}</Text>
						<Text
							className={`text-xs font-bold ${
								isBudgetOver
									? "text-red-600"
									: isBudgetWarning
										? "text-amber-600"
										: "text-emerald-600"
							}`}
						>
							{budgetPct}%
						</Text>
					</View>
					<Text className="text-xl font-bold text-gray-900">
						{formatCurrency(budgetUsage.spent, prefs.currency)}{" "}
						<Text className="text-base font-medium text-gray-400">
							/ {formatCurrency(budgetUsage.limit, prefs.currency)}
						</Text>
					</Text>
					<View className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
						<View
							className={`h-full rounded-full ${
								isBudgetOver
									? "bg-red-500"
									: isBudgetWarning
										? "bg-amber-500"
										: "bg-emerald-500"
							}`}
							style={{ width: `${Math.min(Math.max(budgetPct, 0), 100)}%` }}
						/>
					</View>
					<Text className="mt-3 text-sm text-gray-500">
						{budgetRemaining >= 0
							? t("leftAmount", {
									amount: formatCurrency(budgetRemaining, prefs.currency),
								})
							: t("overBudgetAmount", {
									amount: formatCurrency(Math.abs(budgetRemaining), prefs.currency),
								})}
					</Text>
					{isBudgetWarning ? (
						<Text
							className={`mt-2 text-xs font-semibold ${
								isBudgetOver ? "text-red-600" : "text-amber-600"
							}`}
						>
							{isBudgetOver
								? t("insightBudgetOver", { pct: budgetPct })
								: t("insightBudgetUsage", { pct: budgetPct })}
						</Text>
					) : null}
				</TouchableOpacity>
			) : null}

			{homeInsights.lastTransaction ? (
				<TouchableOpacity
					className="mb-5 mx-5 rounded-3xl border border-gray-100 bg-white p-4"
					onPress={() =>
						router.push({
							pathname: "/movement/[id]",
							params: { id: homeInsights.lastTransaction!.id },
						})
					}
					activeOpacity={0.85}
				>
					<View className="flex-row items-center">
						<View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
							<Ionicons
								name={
									homeInsights.lastTransaction
										.categoryIcon as keyof typeof Ionicons.glyphMap
								}
								size={20}
								color="#2563eb"
							/>
						</View>
						<View className="flex-1">
							<Text className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
								{t("infoLastExpense")}
							</Text>
							<Text className="mt-1 font-semibold text-gray-800">
								{homeInsights.lastTransaction.categoryName}
							</Text>
							<Text className="text-xs text-gray-500">
								{homeInsights.lastTransaction.timeAgo}
							</Text>
						</View>
						<Text className="font-bold text-gray-900">
							{formatCurrency(
								Math.abs(homeInsights.lastTransaction.amount),
								prefs.currency,
							)}
						</Text>
					</View>
				</TouchableOpacity>
			) : null}

			<InsightsSection insights={homeInsights} />

			{hasNoExpenses && (
				<View className="mb-8 px-5">
					<View className="items-center rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-10">
						<View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
							<Ionicons name="wallet-outline" size={30} color="#9ca3af" />
						</View>
						<Text className="text-center text-lg font-bold text-gray-900">
							{t("noExpensesPlaceholder")}
						</Text>
						<Text className="mt-1 text-center text-gray-500">
							{t("tryAdjustingFilters")}
						</Text>
						<TouchableOpacity
							className="mt-5 rounded-2xl bg-primary px-5 py-3"
							onPress={() => router.push("/(tabs)/transact")}
						>
							<Text className="font-bold text-white">{t("addExpense")}</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			<TouchableOpacity
				className="mb-8 px-5"
				onPress={() =>
					router.push({
						pathname: "/reports/categories",
						params: { filter: "week" },
					})
				}
				activeOpacity={0.9}
			>
				<View className="rounded-3xl border border-gray-100 bg-white p-5">
					<Text className="mb-1 font-medium text-gray-500">
						{t("spendingTrends")}
					</Text>
					<Text className="mb-4 text-2xl font-bold text-gray-900">
						{formatCurrency(weekTotal, prefs.currency)}{" "}
						<Text className="text-base font-normal text-gray-400">
							{t("total")}
						</Text>
					</Text>

					<LineChart
						data={{
							labels: weekLabels,
							datasets: [{ data: thisWeekData }],
						}}
						width={screenWidth - 80}
						height={180}
						chartConfig={{
							backgroundColor: "#fff",
							backgroundGradientFrom: "#fff",
							backgroundGradientTo: "#fff",
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
							labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
							style: { borderRadius: 16 },
							propsForDots: { r: "4", strokeWidth: "2", stroke: "#2563eb" },
						}}
						bezier
						style={{
							marginVertical: 8,
							borderRadius: 16,
							transform: [{ translateX: -10 }],
						}}
						withDots
						withInnerLines={false}
						withOuterLines={false}
						withVerticalLines={false}
						withHorizontalLines
					/>
				</View>
			</TouchableOpacity>

			<View className="px-5">
				<View className="mb-4 flex-row items-end justify-between">
					<Text className="text-[20px] font-bold text-gray-900">
						{t("topCategories")}
					</Text>
					<TouchableOpacity
						onPress={() => router.push("/reports/categories")}
						activeOpacity={0.85}
					>
						<Text className="font-medium text-blue-500">{t("seeAll")}</Text>
					</TouchableOpacity>
				</View>

				{categoryTotals.map((cat) => (
					<TouchableOpacity
						key={cat.id}
						className="mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white p-4"
						onPress={() => openBudgetHistory("month", cat.name)}
						activeOpacity={0.85}
					>
						<View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
							<Ionicons
								name={cat.icon as keyof typeof Ionicons.glyphMap}
								size={24}
								color="#f59e0b"
							/>
						</View>
						<View className="flex-1">
							<Text className="mb-1 font-bold text-gray-900">{cat.name}</Text>
							<View className="h-2 max-w-[150px] overflow-hidden rounded bg-gray-100">
								<View
									className="h-full rounded bg-orange-400"
									style={{ width: `${Math.min(cat.percentage, 100)}%` }}
								/>
							</View>
						</View>
						<Text className="font-bold text-gray-900">
							{formatCurrency(cat.amount, prefs.currency)}
						</Text>
					</TouchableOpacity>
				))}

				{categoryTotals.length === 0 && (
					<Text className="py-5 text-center text-gray-400">
						{t("noExpensesThisWeek")}
					</Text>
				)}
			</View>
		</ScrollView>
	);
}
