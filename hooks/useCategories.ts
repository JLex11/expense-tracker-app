import { database } from "@/database";
import type Category from "@/database/models/Category";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;

    const query = database
      .get<Category>("categories")
      .query(Q.sortBy("name", Q.asc));

    // Initial fetch to populate data immediately on mount,
    // before the observe() subscription emits for the first time.
    query.fetch().then((data) => {
      if (active) setCategories(data);
    });

    const subscription = query.observe().subscribe((data) => {
      if (active) setCategories(data);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return categories;
}
