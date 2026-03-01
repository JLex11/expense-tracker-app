import { database } from "@/database";
import type Expense from "@/database/models/Expense";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export function usePendingRecurringExpenses() {
	const [expenses, setExpenses] = useState<Expense[]>([]);

	useEffect(() => {
		const subscription = database
			.get<Expense>("expenses")
			.query(
				Q.where("status", "pending"),
				Q.where("origin", "recurring"),
				Q.sortBy("date", Q.asc),
			)
			.observe()
			.subscribe((data) => {
				setExpenses(data);
			});

		return () => subscription.unsubscribe();
	}, []);

	return expenses;
}
