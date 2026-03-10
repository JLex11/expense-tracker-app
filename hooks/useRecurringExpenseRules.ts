import { database } from "@/database";
import type RecurringExpenseRule from "@/database/models/RecurringExpenseRule";
import { useEffect, useState } from "react";

export function useRecurringExpenseRules() {
  const [rules, setRules] = useState<RecurringExpenseRule[]>([]);

  useEffect(() => {
    let active = true;

    const query = database
      .get<RecurringExpenseRule>("recurring_expense_rules")
      .query();

    // Initial fetch to populate data immediately on mount,
    // before the observe() subscription emits for the first time.
    query.fetch().then((data) => {
      if (active) setRules(data);
    });

    const subscription = query.observe().subscribe((data) => {
      if (active) setRules(data);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return rules;
}
