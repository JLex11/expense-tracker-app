import { database } from "@/database";
import type Budget from "@/database/models/Budget";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export function useBudgets(monthKey?: string) {
	const [budgets, setBudgets] = useState<Budget[]>([]);

	useEffect(() => {
		const collection = database.get<Budget>("budgets");
		const query = monthKey
			? collection.query(Q.where("month_key", monthKey), Q.sortBy("created_at", Q.asc))
			: collection.query(Q.sortBy("created_at", Q.asc));
		const subscription = query.observe().subscribe((data) => {
			setBudgets(data);
		});

		return () => subscription.unsubscribe();
	}, [monthKey]);

	return budgets;
}
