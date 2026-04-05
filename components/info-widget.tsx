import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { Text, TouchableOpacity, View } from "@/tw";
import { formatCurrency } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";

interface InfoWidgetProps {
	todayTotal: number;
	weekTotal: number;
	prevWeekTotal: number;
	onPressToday?: () => void;
	onPressWeek?: () => void;
}

export default function InfoWidget({
	todayTotal,
	weekTotal,
	prevWeekTotal,
	onPressToday,
	onPressWeek,
}: InfoWidgetProps) {
	const prefs = usePrefs();
	const { t } = useI18n();

	const weekDiff = weekTotal - prevWeekTotal;
	const weekTrend = weekDiff > 0 ? "up" : weekDiff < 0 ? "down" : "same";

	return (
		<View className="px-5 mb-6">
			<View className="flex-row flex-wrap gap-3">
				{/* Today total */}
				<TouchableOpacity
					className="flex-1 min-w-[46%] p-4 bg-blue-500 rounded-2xl"
					onPress={onPressToday}
					activeOpacity={0.85}
				>
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
				</TouchableOpacity>

				{/* Weekly summary */}
				<TouchableOpacity
					className="flex-1 min-w-[46%] p-4 bg-white border border-gray-100 rounded-2xl"
					onPress={onPressWeek}
					activeOpacity={0.85}
				>
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
				</TouchableOpacity>
			</View>
		</View>
	);
}
