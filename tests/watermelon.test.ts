import { describe, expect, it } from "vitest";
import { SEED_CATEGORIES } from "@/database/seedCategories";
import { generateUuid, isUuid } from "@/utils/watermelon";

describe("watermelon identity helpers", () => {
	it("generates valid UUID v4 identifiers", () => {
		const ids = new Set<string>();

		for (let index = 0; index < 32; index += 1) {
			const id = generateUuid();
			expect(isUuid(id)).toBe(true);
			ids.add(id);
		}

		expect(ids.size).toBe(32);
	});

	it("keeps seed categories on stable UUIDs", () => {
		const ids = SEED_CATEGORIES.map((category) => category.id);
		expect(ids.every((id) => isUuid(id))).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

