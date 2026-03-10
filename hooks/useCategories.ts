import { database } from "@/database";
import type Category from "@/database/models/Category";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export function useCategories() {
	const [categories, setCategories] = useState<Category[]>([]);

	useEffect(() => {
		const subscription = database
			.get<Category>("categories")
			.query(Q.sortBy("name", Q.asc))
			.observe()
			.subscribe((data) => {
				setCategories(data);
			});

		return () => subscription.unsubscribe();
	}, []);

	return categories;
}
