import type { RecurrenceUnit, RecurringRuleInput } from "@/types/expenses";

export const RECURRENCE_UNITS: RecurrenceUnit[] = ["day", "week", "month"];

const DAY_LABELS: Record<RecurrenceUnit, [string, string]> = {
	day: ["día", "días"],
	week: ["semana", "semanas"],
	month: ["mes", "meses"],
};

export function startOfLocalDay(timestamp: number) {
	const date = new Date(timestamp);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatRecurrenceSummary(
	intervalValue: number,
	intervalUnit: RecurrenceUnit,
) {
	const [singular, plural] = DAY_LABELS[intervalUnit];
	const unitLabel = intervalValue === 1 ? singular : plural;
	return `Cada ${intervalValue} ${unitLabel}`;
}

export function parseRecurrenceInterval(value: string) {
	const parsed = Number.parseInt(value.trim(), 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

export function addRecurringInterval(
	currentTimestamp: number,
	recurrence: RecurringRuleInput,
	anchorTimestamp = currentTimestamp,
) {
	if (recurrence.intervalUnit === "day") {
		const next = new Date(currentTimestamp);
		next.setDate(next.getDate() + recurrence.intervalValue);
		return next.getTime();
	}

	if (recurrence.intervalUnit === "week") {
		const next = new Date(currentTimestamp);
		next.setDate(next.getDate() + recurrence.intervalValue * 7);
		return next.getTime();
	}

	return addMonthsPreservingAnchor(
		currentTimestamp,
		recurrence.intervalValue,
		anchorTimestamp,
	);
}

export function getNextOccurrenceOnOrAfter(
	startTimestamp: number,
	recurrence: RecurringRuleInput,
	minTimestamp: number,
) {
	let candidate = startTimestamp;
	while (startOfLocalDay(candidate) < startOfLocalDay(minTimestamp)) {
		candidate = addRecurringInterval(candidate, recurrence, startTimestamp);
	}

	return candidate;
}

function addMonthsPreservingAnchor(
	currentTimestamp: number,
	monthsToAdd: number,
	anchorTimestamp: number,
) {
	const current = new Date(currentTimestamp);
	const anchor = new Date(anchorTimestamp);
	const anchorDay = anchor.getDate();
	const targetMonthIndex = current.getMonth() + monthsToAdd;
	const targetYear =
		current.getFullYear() + Math.floor(targetMonthIndex / 12);
	const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
	const maxDayInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
	const targetDay = Math.min(anchorDay, maxDayInMonth);

	return new Date(
		targetYear,
		targetMonth,
		targetDay,
		current.getHours(),
		current.getMinutes(),
		current.getSeconds(),
		current.getMilliseconds(),
	).getTime();
}
