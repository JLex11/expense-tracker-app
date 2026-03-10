import type Category from "@/database/models/Category";
import { useI18n } from "@/hooks/useI18n";
import { useExpenses } from "@/hooks/useExpenses";
import { usePrefs } from "@/hooks/usePrefs";
import { Text, View } from "@/tw";
import { formatCurrency } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";

interface InfoWidgetProps {
	categories: Category[];
}

export default function InfoWidget({ categories }: InfoWidgetProps) {
	const expenses = useExpenses();
	const prefs = usePrefs();
	const { t } = useI18n();

	const { todayTotal, lastTransaction, weekTotal, prevWeekTotal, topCategory } =
		useMemo(() => {
			const now = new Date();
			const startOfToday = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
			).getTime();

			// Week calculation
			const weekStartIndex = prefs.weekStart === "Monday" ? 1 : 0;
			const startOfWeek = new Date(startOfToday);
			const daysSinceStart = (now.getDay() - weekStartIndex + 7) % 7;
			startOfWeek.setDate(startOfWeek.getDate() - daysSinceStart);
			const startOfWeekTs = startOfWeek.getTime();

			// Previous week
			const prevWeekStart = new Date(startOfWeek);
			prevWeekStart.setDate(prevWeekStart.getDate() - 7);
			const prevWeekStartTs = prevWeekStart.getTime();

			// Month calculation
			const startOfMonth = new Date(
				now.getFullYear(),
				now.getMonth(),
				1,
			).getTime();

			let today = 0;
			let week = 0;
			let prevWeek = 0;
			const monthCats: Record<string, number> = {};
			let monthTotal = 0;
			let latest: { amount: number; categoryId: string; date: number } | null =
				null;

			for (const exp of expenses) {
				const val = Math.abs(exp.amount);
				if (exp.date >= startOfToday) today += val;
				if (exp.date >= startOfWeekTs) week += val;
				if (exp.date >= prevWeekStartTs && exp.date < startOfWeekTs)
					prevWeek += val;
				if (exp.date >= startOfMonth) {
					monthCats[exp.categoryId] = (monthCats[exp.categoryId] || 0) + val;
					monthTotal += val;
				}
				if (!latest || exp.date > latest.date) {
					latest = {
						amount: exp.amount,
						categoryId: exp.categoryId,
						date: exp.date,
					};
				}
			}

			// Top category of the month
			let topCat: {
				name: string;
				icon: string;
				percentage: number;
			} | null = null;
			const catEntries = Object.entries(monthCats);
			if (catEntries.length > 0) {
				const [topId, topAmount] = catEntries.sort((a, b) => b[1] - a[1])[0];
				const cat = categories.find((c) => c.id === topId);
					topCat = {
						name: cat?.name || t("unknown"),
						icon: cat?.icon || "help",
						percentage: monthTotal > 0 ? (topAmount / monthTotal) * 100 : 0,
					};
			}

			// Last transaction enriched
			let lastTx: {
				amount: number;
				categoryName: string;
				categoryIcon: string;
				timeAgo: string;
			} | null = null;
			if (latest) {
				const cat = categories.find((c) => c.id === latest?.categoryId);
					lastTx = {
						amount: latest.amount,
						categoryName: cat?.name || t("unknown"),
						categoryIcon: cat?.icon || "help",
						timeAgo:
							(() => {
								const diff = Date.now() - latest.date;
								const minutes = Math.floor(diff / 60000);
								if (minutes < 1) return t("timeAgoNow");
								if (minutes < 60) return t("timeAgoMinutes", { value: minutes });
								const hours = Math.floor(minutes / 60);
								if (hours < 24) return t("timeAgoHours", { value: hours });
								const days = Math.floor(hours / 24);
								return t("timeAgoDays", { value: days });
							})(),
					};
				}

			return {
				todayTotal: today,
				lastTransaction: lastTx,
				weekTotal: week,
				prevWeekTotal: prevWeek,
				topCategory: topCat,
			};
			}, [expenses, categories, prefs.weekStart, t]);

	const weekDiff = weekTotal - prevWeekTotal;
	const weekTrend = weekDiff > 0 ? "up" : weekDiff < 0 ? "down" : "same";

	return (
		<View className="px-5 mb-6">
			<View className="flex-row flex-wrap gap-3">
				{/* Today total */}
				<View className="flex-1 min-w-[46%] p-4 bg-blue-500 rounded-2xl">
					<View className="flex-row items-center mb-2">
						<Ionicons
							name="today-outline"
							size={16}
							color="white"
							style={{ marginRight: 6 }}
						/>
						<Text className="text-xs font-medium text-blue-100">
							{t("infoToday")}
						</Text>
						</View>
						<Text className="text-2xl font-bold text-white">
							{formatCurrency(todayTotal, prefs.currency)}
						</Text>
					</View>

				{/* Weekly summary */}
				<View className="flex-1 min-w-[46%] p-4 bg-white border border-gray-100 rounded-2xl">
					<View className="flex-row items-center mb-2">
						<Ionicons
							name="trending-up"
							size={16}
							color="#6b7280"
							style={{ marginRight: 6 }}
						/>
						<Text className="text-xs font-medium text-gray-500">
							{t("infoWeek")}
						</Text>
						</View>
						<Text className="text-2xl font-bold text-gray-900">
							{formatCurrency(weekTotal, prefs.currency)}
						</Text>
					{prevWeekTotal > 0 && (
						<View className="flex-row items-center mt-1">
							<Ionicons
								name={
									weekTrend === "up"
										? "arrow-up"
										: weekTrend === "down"
											? "arrow-down"
											: "remove"
								}
								size={12}
								color={
									weekTrend === "up"
										? "#ef4444"
										: weekTrend === "down"
											? "#22c55e"
											: "#9ca3af"
								}
							/>
							<Text
								className={`ml-1 text-xs font-medium ${
									weekTrend === "up"
										? "text-red-500"
										: weekTrend === "down"
											? "text-green-500"
											: "text-gray-400"
								}`}
								>
									{t("infoVsPrevious", {
										amount: formatCurrency(Math.abs(weekDiff), prefs.currency),
									})}
								</Text>
							</View>
					)}
				</View>

				{/* Last transaction */}
				<View className="flex-1 min-w-[46%] p-4 bg-white border border-gray-100 rounded-2xl">
					<View className="flex-row items-center mb-2">
						<Ionicons
							name="time-outline"
							size={16}
							color="#6b7280"
							style={{ marginRight: 6 }}
						/>
						<Text className="text-xs font-medium text-gray-500">
							{t("infoLastExpense")}
						</Text>
					</View>
					{lastTransaction ? (
						<>
							<View className="flex-row items-center gap-2">
								<Ionicons
									name={
										lastTransaction.categoryIcon as keyof typeof Ionicons.glyphMap
									}
									size={16}
									color="#f59e0b"
								/>
								<Text className="text-sm font-semibold text-gray-800">
									{lastTransaction.categoryName}
								</Text>
							</View>
								<View className="flex-row items-end justify-between mt-1">
									<Text className="text-lg font-bold text-gray-900">
										{formatCurrency(
											Math.abs(lastTransaction.amount),
											prefs.currency,
										)}
									</Text>
								<Text className="text-xs text-gray-400">
									{lastTransaction.timeAgo}
								</Text>
							</View>
						</>
						) : (
							<Text className="text-sm text-gray-400">{t("infoNoExpensesYet")}</Text>
						)}
					</View>

				{/* Top category of the month */}
				<View className="flex-1 min-w-[46%] p-4 bg-white border border-gray-100 rounded-2xl">
					<View className="flex-row items-center mb-2">
						<Ionicons
							name="trophy-outline"
							size={16}
							color="#6b7280"
							style={{ marginRight: 6 }}
						/>
						<Text className="text-xs font-medium text-gray-500">
							{t("infoTopMonth")}
						</Text>
					</View>
					{topCategory ? (
						<>
							<View className="flex-row items-center gap-2">
								<Ionicons
									name={topCategory.icon as keyof typeof Ionicons.glyphMap}
									size={16}
									color="#8b5cf6"
								/>
								<Text className="text-sm font-semibold text-gray-800">
									{topCategory.name}
								</Text>
							</View>
							<View className="mt-2">
								<View className="h-1.5 overflow-hidden rounded bg-gray-100">
									<View
										className="h-full bg-violet-400 rounded"
										style={{
											width: `${Math.min(topCategory.percentage, 100)}%`,
										}}
									/>
								</View>
								<Text className="mt-1 text-xs text-gray-400">
									{topCategory.percentage.toFixed(0)}% del mes
								</Text>
							</View>
						</>
						) : (
							<Text className="text-sm text-gray-400">{t("infoNoData")}</Text>
						)}
					</View>
			</View>
		</View>
	);
}
