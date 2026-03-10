import { database } from "@/database";
import type Budget from "@/database/models/Budget";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export function useBudgets(monthKey?: string) {
  const [budgets, setBudgets] = useState<Budget[]>([]);

  useEffect(() => {
    let active = true;

    const collection = database.get<Budget>("budgets");
    const query = monthKey
      ? collection.query(
          Q.where("month_key", monthKey),
          Q.sortBy("created_at", Q.asc),
        )
      : collection.query(Q.sortBy("created_at", Q.asc));

    // Initial fetch to populate data immediately on mount,
    // before the observe() subscription emits for the first time.
    query.fetch().then((data) => {
      if (active) setBudgets(data);
    });

    const subscription = query.observe().subscribe((data) => {
      if (active) setBudgets(data);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [monthKey]);

  return budgets;
}
