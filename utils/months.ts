import type { AppLanguage } from "@/hooks/usePrefs";
import { getLocaleTag } from "@/utils/i18n";

export function getMonthKey(input: Date | number) {
	const date = typeof input === "number" ? new Date(input) : input;
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	return `${year}-${month}`;
}

export function parseMonthKey(monthKey: string) {
	const [yearText, monthText] = monthKey.split("-");
	const year = Number.parseInt(yearText, 10);
	const month = Number.parseInt(monthText, 10);

	if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
		return new Date();
	}

	return new Date(year, month - 1, 1);
}

export function shiftMonthKey(monthKey: string, offset: number) {
	const date = parseMonthKey(monthKey);
	date.setMonth(date.getMonth() + offset);
	return getMonthKey(date);
}

export function getMonthBounds(monthKey: string) {
	const start = parseMonthKey(monthKey);
	const end = new Date(start);
	end.setMonth(end.getMonth() + 1);
	return {
		start: start.getTime(),
		end: end.getTime(),
	};
}

export function formatMonthLabel(monthKey: string, language: AppLanguage = "es") {
	return parseMonthKey(monthKey).toLocaleDateString(getLocaleTag(language), {
		month: "long",
		year: "numeric",
	});
}
