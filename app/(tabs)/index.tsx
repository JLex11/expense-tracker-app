import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
	Dimensions,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "@/database";
import type Category from "@/database/models/Category";
import { useExpenses } from "@/hooks/useExpenses";

const screenWidth = Dimensions.get("window").width;

function getGreeting() {
	const hour = new Date().getHours();
	if (hour < 12) return "Good Morning";
	if (hour < 18) return "Good Afternoon";
	return "Good Evening";
}

export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const expenses = useExpenses();
	const [categories, setCategories] = React.useState<Category[]>([]);

	React.useEffect(() => {
		database.get<Category>("categories").query().fetch().then(setCategories);
	}, []);

	const { todayTotal, weekTotal, thisWeekData, categoryTotals } =
		useMemo(() => {
			const now = new Date();
			const startOfToday = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
			).getTime();
			const startOfWeek = new Date(startOfToday);
			startOfWeek.setDate(startOfWeek.getDate() - now.getDay());

			let todayTotal = 0;
			let weekTotal = 0;
			const weekDaysArr = [0, 0, 0, 0, 0, 0, 0];
			const catGraph: Record<string, number> = {};

			expenses.forEach((exp) => {
				const expDate = new Date(exp.date);
				const val = Math.abs(exp.amount);
				if (exp.date >= startOfToday) todayTotal += val;
				if (exp.date >= startOfWeek.getTime()) {
					weekTotal += val;
					weekDaysArr[expDate.getDay()] += val;
				}
				catGraph[exp.categoryId] = (catGraph[exp.categoryId] || 0) + val;
			});

			const topCats = Object.entries(catGraph)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([id, amount]) => {
					const cat = categories.find((c) => c.id === id);
					return {
						id,
						name: cat?.name || "Unknown",
						icon: cat?.icon || "help",
						amount,
						percentage: weekTotal > 0 ? (amount / weekTotal) * 100 : 0,
					};
				});

			return {
				todayTotal,
				weekTotal,
				thisWeekData: weekDaysArr,
				categoryTotals: topCats,
			};
		}, [expenses, categories]);

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
		>
			{/* Header */}
			<View style={styles.headerRow}>
				<View style={styles.headerLeft}>
					<View style={styles.avatar}>
						<Ionicons name="person" size={24} color="#3b82f6" />
					</View>
					<View>
						<Text style={styles.welcomeText}>Welcome back,</Text>
						<Text style={styles.greetingText}>{getGreeting()}, Alex</Text>
					</View>
				</View>
				<TouchableOpacity style={styles.notificationBtn}>
					<Ionicons name="notifications-outline" size={24} color="#4b5563" />
				</TouchableOpacity>
			</View>

			{/* KPI Cards */}
			<View style={styles.kpiRow}>
				<View style={[styles.kpiCard, styles.kpiCardBlue]}>
					<View style={styles.kpiCardHeader}>
						<Ionicons
							name="calendar"
							size={16}
							color="white"
							style={{ marginRight: 6 }}
						/>
						<Text style={styles.kpiLabelBlue}>Today</Text>
					</View>
					<Text style={styles.kpiValueBlue}>${todayTotal.toFixed(2)}</Text>
				</View>
				<View style={[styles.kpiCard, styles.kpiCardWhite]}>
					<View style={styles.kpiCardHeader}>
						<Ionicons
							name="calendar-outline"
							size={16}
							color="#6b7280"
							style={{ marginRight: 6 }}
						/>
						<Text style={styles.kpiLabelGray}>This Week</Text>
					</View>
					<Text style={styles.kpiValueDark}>${weekTotal.toFixed(2)}</Text>
				</View>
			</View>

			{/* Chart */}
			<View style={styles.chartSection}>
				<View style={styles.chartCard}>
					<Text style={styles.chartSubtitle}>Spending Trends</Text>
					<Text style={styles.chartTotal}>
						${weekTotal.toFixed(2)}{" "}
						<Text style={styles.chartTotalSub}>Total</Text>
					</Text>
					<LineChart
						data={{
							labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
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
			</View>

			{/* Top Categories */}
			<View style={styles.categoriesSection}>
				<View style={styles.categoriesHeader}>
					<Text style={styles.categoriesTitle}>Top Categories</Text>
					<Text style={styles.categoriesSeeAll}>See All</Text>
				</View>
				{categoryTotals.map((cat) => (
					<View key={cat.id} style={styles.categoryRow}>
						<View style={styles.categoryIcon}>
							<Ionicons name={cat.icon as any} size={24} color="#f59e0b" />
						</View>
						<View style={styles.categoryInfo}>
							<Text style={styles.categoryName}>{cat.name}</Text>
							<View style={styles.progressBarBg}>
								<View
									style={[
										styles.progressBarFill,
										{ width: `${Math.min(cat.percentage, 100)}%` as any },
									]}
								/>
							</View>
						</View>
						<Text style={styles.categoryAmount}>${cat.amount.toFixed(2)}</Text>
					</View>
				))}
				{categoryTotals.length === 0 && (
					<Text style={styles.emptyText}>No expenses this week</Text>
				)}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	content: { paddingBottom: 100 },
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		marginBottom: 32,
	},
	headerLeft: { flexDirection: "row", alignItems: "center" },
	avatar: {
		width: 48,
		height: 48,
		backgroundColor: "#DBEAFE",
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	welcomeText: { color: "#6B7280", fontSize: 14 },
	greetingText: { color: "#111827", fontSize: 20, fontWeight: "bold" },
	notificationBtn: {
		padding: 8,
		backgroundColor: "white",
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	kpiRow: {
		flexDirection: "row",
		gap: 16,
		paddingHorizontal: 20,
		marginBottom: 32,
	},
	kpiCard: { flex: 1, borderRadius: 24, padding: 20 },
	kpiCardBlue: { backgroundColor: "#3b82f6" },
	kpiCardWhite: {
		backgroundColor: "white",
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	kpiCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	kpiLabelBlue: { color: "#BFDBFE", fontWeight: "500" },
	kpiLabelGray: { color: "#6B7280", fontWeight: "500" },
	kpiValueBlue: { color: "white", fontSize: 28, fontWeight: "bold" },
	kpiValueDark: { color: "#1F2937", fontSize: 28, fontWeight: "bold" },
	chartSection: { paddingHorizontal: 20, marginBottom: 32 },
	chartCard: {
		backgroundColor: "white",
		borderRadius: 24,
		padding: 20,
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	chartSubtitle: { color: "#6B7280", fontWeight: "500", marginBottom: 4 },
	chartTotal: {
		color: "#111827",
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 16,
	},
	chartTotalSub: { fontSize: 14, fontWeight: "normal", color: "#9CA3AF" },
	categoriesSection: { paddingHorizontal: 20 },
	categoriesHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		marginBottom: 16,
	},
	categoriesTitle: { color: "#111827", fontSize: 18, fontWeight: "bold" },
	categoriesSeeAll: { color: "#3b82f6", fontWeight: "500" },
	categoryRow: {
		backgroundColor: "white",
		borderRadius: 16,
		padding: 16,
		marginBottom: 12,
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	categoryIcon: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: "#F9FAFB",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	categoryInfo: { flex: 1 },
	categoryName: { color: "#111827", fontWeight: "bold", marginBottom: 4 },
	progressBarBg: {
		height: 8,
		backgroundColor: "#F3F4F6",
		borderRadius: 4,
		overflow: "hidden",
		maxWidth: 150,
	},
	progressBarFill: {
		height: "100%",
		backgroundColor: "#FB923C",
		borderRadius: 4,
	},
	categoryAmount: { color: "#111827", fontWeight: "bold" },
	emptyText: { color: "#9CA3AF", textAlign: "center", paddingVertical: 20 },
});
