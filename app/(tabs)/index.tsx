import { database } from "@/database";
import type Category from "@/database/models/Category";
import { useExpenses } from "@/hooks/useExpenses";
import { usePrefs } from "@/hooks/usePrefs";
import { ScrollView, Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
	const prefs = usePrefs();
	const [categories, setCategories] = React.useState<Category[]>([]);

	React.useEffect(() => {
		database.get<Category>("categories").query().fetch().then(setCategories);
	}, []);

	const { todayTotal, weekTotal, thisWeekData, weekLabels, categoryTotals } =
		useMemo(() => {
			const now = new Date();
			const startOfToday = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
			).getTime();
			const weekStartIndex = prefs.weekStart === "Monday" ? 1 : 0;
			const labels =
				weekStartIndex === 1
					? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
					: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			const startOfWeek = new Date(startOfToday);
			const daysSinceStart = (now.getDay() - weekStartIndex + 7) % 7;
			startOfWeek.setDate(startOfWeek.getDate() - daysSinceStart);

			let today = 0;
			let week = 0;
			const weekDaysArr = [0, 0, 0, 0, 0, 0, 0];
			const catGraph: Record<string, number> = {};

			expenses.forEach((exp) => {
				const expDate = new Date(exp.date);
				const val = Math.abs(exp.amount);
				if (exp.date >= startOfToday) today += val;
				if (exp.date >= startOfWeek.getTime()) {
					week += val;
					const weekDayIndex = (expDate.getDay() - weekStartIndex + 7) % 7;
					weekDaysArr[weekDayIndex] += val;
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
						percentage: week > 0 ? (amount / week) * 100 : 0,
					};
				});

			return {
				todayTotal: today,
				weekTotal: week,
				thisWeekData: weekDaysArr,
				weekLabels: labels,
				categoryTotals: topCats,
			};
		}, [expenses, categories, prefs.weekStart]);

	return (
		<ScrollView
			className="flex-1 bg-gray-50"
			contentContainerStyle={{
				paddingTop: insets.top + 20,
				paddingBottom: 100,
			}}
		>
			<View className="flex-row items-center justify-between px-5 mb-8">
				<View className="flex-row items-center">
					<View className="items-center justify-center w-12 h-12 mr-3 bg-blue-100 rounded-full">
						<Ionicons name="person" size={24} color="#3b82f6" />
					</View>
					<View>
						<Text className="text-gray-500">Welcome back,</Text>
						<Text className="text-[20px] font-bold text-gray-900">
							{getGreeting()}, Alex
						</Text>
					</View>
				</View>
				<TouchableOpacity className="p-2 bg-white border border-gray-100 rounded-full">
					<Ionicons name="notifications-outline" size={24} color="#4b5563" />
				</TouchableOpacity>
			</View>

			<View className="flex-row gap-4 px-5 mb-8">
				<View className="flex-1 p-5 bg-blue-500 rounded-3xl">
					<View className="flex-row items-center mb-3">
						<Ionicons
							name="calendar"
							size={16}
							color="white"
							style={{ marginRight: 6 }}
						/>
						<Text className="font-medium text-blue-100">Today</Text>
					</View>
					<Text className="text-[28px] font-bold text-white">
						${todayTotal.toFixed(2)}
					</Text>
				</View>

				<View className="flex-1 p-5 bg-white border border-gray-100 rounded-3xl">
					<View className="flex-row items-center mb-3">
						<Ionicons
							name="calendar-outline"
							size={16}
							color="#6b7280"
							style={{ marginRight: 6 }}
						/>
						<Text className="font-medium text-gray-500">This Week</Text>
					</View>
					<Text className="text-[28px] font-bold text-gray-800">
						${weekTotal.toFixed(2)}
					</Text>
				</View>
			</View>

			<View className="px-5 mb-8">
				<View className="p-5 bg-white border border-gray-100 rounded-3xl">
					<Text className="mb-1 font-medium text-gray-500">
						Spending Trends
					</Text>
					<Text className="mb-4 text-2xl font-bold text-gray-900">
						${weekTotal.toFixed(2)}{" "}
						<Text className="text-base font-normal text-gray-400">Total</Text>
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
			</View>

			<View className="px-5">
				<View className="flex-row items-end justify-between mb-4">
					<Text className="text-[20px] font-bold text-gray-900">
						Top Categories
					</Text>
					<Text className="font-medium text-blue-500">See All</Text>
				</View>
				{categoryTotals.map((cat) => (
					<View
						key={cat.id}
						className="flex-row items-center p-4 mb-3 bg-white border border-gray-100 rounded-2xl"
					>
						<View className="items-center justify-center w-12 h-12 mr-4 rounded-xl bg-orange-50">
							<Ionicons name={cat.icon as any} size={24} color="#f59e0b" />
						</View>
						<View className="flex-1">
							<Text className="mb-1 font-bold text-gray-900">{cat.name}</Text>
							<View className="h-2 max-w-[150px] overflow-hidden rounded bg-gray-100">
								<View
									className="h-full bg-orange-400 rounded"
									style={{ width: `${Math.min(cat.percentage, 100)}%` as any }}
								/>
							</View>
						</View>
						<Text className="font-bold text-gray-900">
							${cat.amount.toFixed(2)}
						</Text>
					</View>
				))}

				{categoryTotals.length === 0 && (
					<Text className="py-5 text-center text-gray-400">
						No expenses this week
					</Text>
				)}
			</View>
		</ScrollView>
	);
}
