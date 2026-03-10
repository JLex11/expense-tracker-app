import { describe, expect, it } from "vitest";
import {
	addRecurringInterval,
	getNextOccurrenceOnOrAfter,
	parseRecurrenceInterval,
	startOfLocalDay,
} from "@/utils/recurrence";
import {
	formatMonthLabel,
	getMonthBounds,
	getMonthKey,
	shiftMonthKey,
} from "@/utils/months";

describe("recurrence utils", () => {
	it("rejects invalid recurrence intervals", () => {
		expect(parseRecurrenceInterval("0")).toBeNull();
		expect(parseRecurrenceInterval("-4")).toBeNull();
		expect(parseRecurrenceInterval("abc")).toBeNull();
		expect(parseRecurrenceInterval(" 3 ")).toBe(3);
	});

	it("preserves the anchor day for monthly recurrence", () => {
		const january31 = new Date(2025, 0, 31, 9, 30).getTime();
		const next = addRecurringInterval(january31, {
			intervalValue: 1,
			intervalUnit: "month",
		});

		const date = new Date(next);
		expect(date.getFullYear()).toBe(2025);
		expect(date.getMonth()).toBe(1);
		expect(date.getDate()).toBe(28);
		expect(date.getHours()).toBe(9);
		expect(date.getMinutes()).toBe(30);
	});

	it("catches up recurring rules to the next due date", () => {
		const start = new Date(2025, 0, 1, 8, 0).getTime();
		const min = new Date(2025, 0, 22, 12, 0).getTime();

		const next = getNextOccurrenceOnOrAfter(
			start,
			{ intervalValue: 1, intervalUnit: "week" },
			min,
		);

		const date = new Date(next);
		expect(startOfLocalDay(date.getTime())).toBe(
			startOfLocalDay(new Date(2025, 0, 22, 8, 0).getTime()),
		);
	});
});

describe("month helpers", () => {
	it("builds and shifts month keys", () => {
		const key = getMonthKey(new Date(2026, 2, 7));
		expect(key).toBe("2026-03");
		expect(shiftMonthKey(key, -1)).toBe("2026-02");
		expect(shiftMonthKey(key, 1)).toBe("2026-04");
	});

	it("returns month bounds and labels", () => {
		const { start, end } = getMonthBounds("2026-03");
		expect(new Date(start).getFullYear()).toBe(2026);
		expect(new Date(start).getMonth()).toBe(2);
		expect(new Date(end).getMonth()).toBe(3);
		expect(formatMonthLabel("2026-03")).toContain("2026");
	});
});
