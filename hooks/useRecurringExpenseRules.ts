import { database } from "@/database";
import type RecurringExpenseRule from "@/database/models/RecurringExpenseRule";
import { useEffect, useState } from "react";

export function useRecurringExpenseRules() {
	const [rules, setRules] = useState<RecurringExpenseRule[]>([]);

	useEffect(() => {
		const subscription = database
			.get<RecurringExpenseRule>("recurring_expense_rules")
			.query()
			.observe()
			.subscribe((data) => {
				setRules(data);
			});

		return () => subscription.unsubscribe();
	}, []);

	return rules;
}
