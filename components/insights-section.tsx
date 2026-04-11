import type { HomeInsightsResult } from "@/hooks/useHomeInsights";
import { useI18n } from "@/hooks/useI18n";
import { usePrefsSelector } from "@/hooks/usePrefs";
import { ScrollView, Text, View } from "@/tw";
import { formatCurrency } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";

interface InsightsSectionProps {
	insights: HomeInsightsResult;
}

interface InsightChip {
	key: string;
	icon: keyof typeof Ionicons.glyphMap;
	text: string;
	color: "green" | "red" | "orange" | "violet" | "blue";
}

const chipColors = {
	green: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "#059669" },
	red: { bg: "bg-red-50", text: "text-red-700", icon: "#dc2626" },
	orange: { bg: "bg-amber-50", text: "text-amber-700", icon: "#d97706" },
	violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "#7c3aed" },
	blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "#2563eb" },
};

export default function InsightsSection({ insights }: InsightsSectionProps) {
	const { t } = useI18n();
	const currency = usePrefsSelector((prefs) => prefs.currency);

	const chips: InsightChip[] = [];

	// 1. Week vs previous week
	if (insights.prevWeekTotal > 0) {
		const diff = insights.weekTotal - insights.prevWeekTotal;
		const pct = Math.round(
			(Math.abs(diff) / insights.prevWeekTotal) * 100,
		);
		if (diff > 0) {
			chips.push({
				key: "week",
				icon: "trending-up",
				text: t("insightWeekMore", { pct }),
				color: "red",
			});
		} else if (diff < 0) {
			chips.push({
				key: "week",
				icon: "trending-down",
				text: t("insightWeekLess", { pct }),
				color: "green",
			});
		} else {
			chips.push({
				key: "week",
				icon: "remove-outline",
				text: t("insightWeekSame"),
				color: "blue",
			});
		}
	}

	// 2. Top category of the month
	if (insights.topCategory) {
		chips.push({
			key: "topCat",
			icon: insights.topCategory.icon as keyof typeof Ionicons.glyphMap,
			text: t("insightTopCategory", {
				name: insights.topCategory.name,
				pct: Math.round(insights.topCategory.percentage),
			}),
			color: "violet",
		});
	}

	// 3. Budget usage
	if (insights.budgetUsage) {
		const pct = Math.round(insights.budgetUsage.ratio * 100);
		const isOver = insights.budgetUsage.ratio >= 1;
		const isWarning = insights.budgetUsage.ratio >= 0.8;
		chips.push({
			key: "budget",
			icon: "pie-chart-outline",
			text: isOver
				? t("insightBudgetOver", { pct })
				: t("insightBudgetUsage", { pct }),
			color: isOver ? "red" : isWarning ? "orange" : "green",
		});
	}

	// 4. Last transaction
	if (insights.lastTransaction) {
		chips.push({
			key: "lastTx",
			icon: insights.lastTransaction.categoryIcon as keyof typeof Ionicons.glyphMap,
			text: t("insightLastExpense", {
				amount: formatCurrency(Math.abs(insights.lastTransaction.amount), currency),
				category: insights.lastTransaction.categoryName,
				time: insights.lastTransaction.timeAgo,
			}),
			color: "blue",
		});
	}

	// 5. Today vs yesterday
	if (insights.todayTotal > 0 || insights.yesterdayTotal > 0) {
		const todayMore = insights.todayTotal > insights.yesterdayTotal;
		chips.push({
			key: "todayVsYesterday",
			icon: "swap-horizontal",
			text: t("insightTodayVsYesterday", {
				today: formatCurrency(insights.todayTotal, currency),
				yesterday: formatCurrency(insights.yesterdayTotal, currency),
			}),
			color: todayMore ? "red" : "green",
		});
	}

	if (chips.length === 0) return null;

	return (
		<View className="mb-6">
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="px-5 gap-2"
			>
				{chips.map((chip) => {
					const colors = chipColors[chip.color];
					return (
						<View
							key={chip.key}
							className={`flex-row items-center rounded-full px-3.5 py-2 ${colors.bg}`}
						>
							<Ionicons
								name={chip.icon}
								size={14}
								color={colors.icon}
								style={{ marginRight: 6 }}
							/>
							<Text className={`text-xs font-medium ${colors.text}`}>
								{chip.text}
							</Text>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}
