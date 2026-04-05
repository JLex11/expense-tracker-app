import type Budget from "@/database/models/Budget";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import type { WeekStart } from "@/hooks/usePrefs";
import { useI18n } from "@/hooks/useI18n";
import { useMemo } from "react";

export interface HomeInsightsResult {
	todayTotal: number;
	yesterdayTotal: number;
	weekTotal: number;
	prevWeekTotal: number;
	topCategory: {
		id: string;
		name: string;
		icon: string;
		percentage: number;
	} | null;
	lastTransaction: {
		id: string;
		amount: number;
		categoryName: string;
		categoryIcon: string;
		timeAgo: string;
	} | null;
	budgetUsage: {
		spent: number;
		limit: number;
		ratio: number;
	} | null;
}

export function useHomeInsights(
	expenses: Expense[],
	categories: Category[],
	budgets: Budget[],
	weekStart: WeekStart,
): HomeInsightsResult {
	const { t } = useI18n();

	return useMemo(() => {
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();

		const startOfYesterday = startOfToday - 86_400_000;

		// Week calculation
		const weekStartIndex = weekStart === "Monday" ? 1 : 0;
		const startOfWeek = new Date(startOfToday);
		const daysSinceStart = (now.getDay() - weekStartIndex + 7) % 7;
		startOfWeek.setDate(startOfWeek.getDate() - daysSinceStart);
		const startOfWeekTs = startOfWeek.getTime();

		// Previous week
		const prevWeekStartTs = startOfWeekTs - 7 * 86_400_000;

		// Month calculation
		const startOfMonth = new Date(
			now.getFullYear(),
			now.getMonth(),
			1,
		).getTime();

		let today = 0;
		let yesterday = 0;
		let week = 0;
		let prevWeek = 0;
		const monthCats: Record<string, number> = {};
		let monthTotal = 0;
		let latest:
			| { id: string; amount: number; categoryId: string; date: number }
			| null = null;

		for (const exp of expenses) {
			const val = Math.abs(exp.amount);
			if (exp.date >= startOfToday) today += val;
			if (exp.date >= startOfYesterday && exp.date < startOfToday)
				yesterday += val;
			if (exp.date >= startOfWeekTs) week += val;
			if (exp.date >= prevWeekStartTs && exp.date < startOfWeekTs)
				prevWeek += val;
			if (exp.date >= startOfMonth) {
				monthCats[exp.categoryId] = (monthCats[exp.categoryId] || 0) + val;
				monthTotal += val;
			}
			if (!latest || exp.date > latest.date) {
				latest = {
					id: exp.id,
					amount: exp.amount,
					categoryId: exp.categoryId,
					date: exp.date,
				};
			}
		}

		// Top category of the month
		let topCat: HomeInsightsResult["topCategory"] = null;
		const catEntries = Object.entries(monthCats);
		if (catEntries.length > 0) {
			const [topId, topAmount] = catEntries.sort((a, b) => b[1] - a[1])[0];
			const cat = categories.find((c) => c.id === topId);
			topCat = {
				id: topId,
				name: cat?.name || t("unknown"),
				icon: cat?.icon || "help",
				percentage: monthTotal > 0 ? (topAmount / monthTotal) * 100 : 0,
			};
		}

		// Last transaction enriched
		let lastTx: HomeInsightsResult["lastTransaction"] = null;
		if (latest) {
			const cat = categories.find((c) => c.id === latest?.categoryId);
			lastTx = {
				id: latest.id,
				amount: latest.amount,
				categoryName: cat?.name || t("unknown"),
				categoryIcon: cat?.icon || "help",
				timeAgo: (() => {
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

		// Budget usage (aggregate all budgets for current month)
		let budgetUsage: HomeInsightsResult["budgetUsage"] = null;
		if (budgets.length > 0) {
			let totalLimit = 0;
			let totalSpent = 0;
			for (const budget of budgets) {
				totalLimit += budget.limitAmount;
				totalSpent += monthCats[budget.categoryId] || 0;
			}
			if (totalLimit > 0) {
				budgetUsage = {
					spent: totalSpent,
					limit: totalLimit,
					ratio: totalSpent / totalLimit,
				};
			}
		}

		return {
			todayTotal: today,
			yesterdayTotal: yesterday,
			weekTotal: week,
			prevWeekTotal: prevWeek,
			topCategory: topCat,
			lastTransaction: lastTx,
			budgetUsage,
		};
	}, [expenses, categories, budgets, weekStart, t]);
}
