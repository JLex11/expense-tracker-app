import { database } from "@/database";
import type Expense from "@/database/models/Expense";
import { useEffect, useState } from "react";

export function useExpenses() {
	const [expenses, setExpenses] = useState<Expense[]>([]);

	useEffect(() => {
		const subscription = database.collections
			.get<Expense>("expenses")
			.query()
			.observe()
			.subscribe((data) => {
				setExpenses(data);
			});

		return () => subscription.unsubscribe();
	}, []);

	return expenses;
}
