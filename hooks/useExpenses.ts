import { database } from "@/database";
import type Expense from "@/database/models/Expense";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    let active = true;

    const query = database
      .get<Expense>("expenses")
      .query(Q.where("status", "confirmed"));

    // Initial fetch to populate data immediately on mount,
    // before the observe() subscription emits for the first time.
    query.fetch().then((data) => {
      if (active) setExpenses(data);
    });

    const subscription = query.observe().subscribe((data) => {
      if (active) setExpenses(data);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return expenses;
}
