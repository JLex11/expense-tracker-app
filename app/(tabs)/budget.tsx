import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "@/database";
import type Category from "@/database/models/Category";
import { useExpenses } from "@/hooks/useExpenses";

type FilterType = "today" | "week" | "month" | "custom";
const FILTERS: { key: FilterType; label: string }[] = [
	{ key: "today", label: "Today" },
	{ key: "week", label: "This Week" },
	{ key: "month", label: "This Month" },
	{ key: "custom", label: "Custom" },
];

export default function HistoryScreen() {
	const insets = useSafeAreaInsets();
	const expenses = useExpenses();
	const [categories, setCategories] = useState<Category[]>([]);
	const [filter, setFilter] = useState<FilterType>("month");
	const [searchQuery, setSearchQuery] = useState("");

	React.useEffect(() => {
		database.get<Category>("categories").query().fetch().then(setCategories);
	}, []);

	const filteredExpenses = useMemo(() => {
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();
		const startOfWeek = new Date(startOfToday);
		startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
		const startOfMonth = new Date(
			now.getFullYear(),
			now.getMonth(),
			1,
		).getTime();

		return expenses
			.filter((exp) => {
				if (searchQuery) {
					const q = searchQuery.toLowerCase();
					const cat = categories.find((c) => c.id === exp.categoryId);
					if (
						!exp.note?.toLowerCase().includes(q) &&
						!cat?.name.toLowerCase().includes(q)
					)
						return false;
				}
				if (filter === "today") return exp.date >= startOfToday;
				if (filter === "week") return exp.date >= startOfWeek.getTime();
				if (filter === "month") return exp.date >= startOfMonth;
				return true;
			})
			.sort((a, b) => b.date - a.date);
	}, [expenses, filter, searchQuery, categories]);

	const groupedExpenses = useMemo(() => {
		const groups: Record<string, typeof expenses> = {};
		const now = new Date();
		const startOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime();
		const startOfYesterday = startOfToday - 86400000;

		filteredExpenses.forEach((exp) => {
			let groupName = "";
			if (exp.date >= startOfToday) groupName = "TODAY";
			else if (exp.date >= startOfYesterday) groupName = "YESTERDAY";
			else
				groupName = new Date(exp.date)
					.toLocaleDateString(undefined, { month: "short", day: "numeric" })
					.toUpperCase();
			if (!groups[groupName]) groups[groupName] = [];
			groups[groupName].push(exp);
		});
		return groups;
	}, [filteredExpenses]);

	const handleDelete = (id: string) => {
		Alert.alert(
			"Delete Expense",
			"Are you sure you want to delete this expense?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await database.write(async () => {
								const expense = await database.get("expenses").find(id);
								await (expense as any).destroyPermanently();
							});
						} catch (e) {
							console.error(e);
						}
					},
				},
			],
		);
	};

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Expense History</Text>
				<TouchableOpacity style={styles.headerBtn}>
					<Ionicons name="add" size={24} color="#3b82f6" />
				</TouchableOpacity>
			</View>

			{/* Filters + Search */}
			<View style={styles.toolbar}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={{ marginBottom: 12 }}
				>
					<View style={styles.filterRow}>
						{FILTERS.map((f) => (
							<TouchableOpacity
								key={f.key}
								onPress={() => setFilter(f.key)}
								style={[
									styles.filterChip,
									filter === f.key && styles.filterChipActive,
								]}
							>
								<Text
									style={[
										styles.filterLabel,
										filter === f.key && styles.filterLabelActive,
									]}
								>
									{f.label}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</ScrollView>
				<View style={styles.searchBar}>
					<Ionicons name="search" size={20} color="#9ca3af" />
					<TextInput
						style={styles.searchInput}
						placeholder="Search by notes or category..."
						placeholderTextColor="#9ca3af"
						value={searchQuery}
						onChangeText={setSearchQuery}
					/>
					{searchQuery.length > 0 && (
						<TouchableOpacity onPress={() => setSearchQuery("")}>
							<Ionicons name="close-circle" size={20} color="#9ca3af" />
						</TouchableOpacity>
					)}
				</View>
			</View>

			{/* Expenses list */}
			<ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
				{Object.entries(groupedExpenses).map(([groupName, exps]) => (
					<View key={groupName} style={styles.group}>
						<Text style={styles.groupLabel}>{groupName}</Text>
						<View style={styles.groupCard}>
							{exps.map((exp, index) => {
								const cat = categories.find((c) => c.id === exp.categoryId);
								const isLast = index === exps.length - 1;
								const timeText = new Date(exp.date).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								});
								return (
									<TouchableOpacity
										key={exp.id}
										onLongPress={() => handleDelete(exp.id)}
										delayLongPress={500}
										style={[
											styles.expenseRow,
											!isLast && styles.expenseRowBorder,
										]}
									>
										<View style={styles.expenseIcon}>
											<Ionicons
												name={(cat?.icon || "help-circle") as any}
												size={24}
												color="#f59e0b"
											/>
										</View>
										<View style={styles.expenseInfo}>
											<Text style={styles.expenseName}>
												{cat?.name || "Unknown"}
											</Text>
											<Text style={styles.expenseNote} numberOfLines={1}>
												{exp.note || "No notes"}
											</Text>
										</View>
										<View style={styles.expenseRight}>
											<Text style={styles.expenseAmount}>
												-${exp.amount.toFixed(2)}
											</Text>
											<Text style={styles.expenseTime}>{timeText}</Text>
										</View>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
				))}
				{filteredExpenses.length === 0 && (
					<View style={styles.emptyState}>
						<View style={styles.emptyIcon}>
							<Ionicons name="receipt-outline" size={40} color="#d1d5db" />
						</View>
						<Text style={styles.emptyTitle}>No expenses found</Text>
						<Text style={styles.emptySubtitle}>
							Try adjusting your filters or search query.
						</Text>
					</View>
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "white" },
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	headerTitle: { fontSize: 24, fontWeight: "bold", color: "#111827" },
	headerBtn: {
		width: 40,
		height: 40,
		backgroundColor: "#EFF6FF",
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	toolbar: {
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
		backgroundColor: "white",
	},
	filterRow: { flexDirection: "row", gap: 8 },
	filterChip: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: "#F3F4F6",
	},
	filterChipActive: { backgroundColor: "#3b82f6" },
	filterLabel: {
		fontWeight: "500",
		color: "#6B7280",
		textTransform: "capitalize",
	},
	filterLabelActive: { color: "white" },
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F9FAFB",
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		gap: 8,
	},
	searchInput: { flex: 1, color: "#1F2937", fontWeight: "500", fontSize: 14 },
	group: { marginTop: 24, paddingHorizontal: 20 },
	groupLabel: {
		color: "#9CA3AF",
		fontSize: 12,
		fontWeight: "bold",
		letterSpacing: 2,
		marginBottom: 12,
	},
	groupCard: {
		backgroundColor: "white",
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "#F3F4F6",
		overflow: "hidden",
	},
	expenseRow: {
		flexDirection: "row",
		padding: 16,
		alignItems: "center",
		backgroundColor: "white",
	},
	expenseRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
	expenseIcon: {
		width: 48,
		height: 48,
		borderRadius: 16,
		backgroundColor: "#FFF7ED",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	expenseInfo: { flex: 1 },
	expenseName: { color: "#111827", fontWeight: "bold", marginBottom: 4 },
	expenseNote: { color: "#9CA3AF", fontSize: 12 },
	expenseRight: { alignItems: "flex-end" },
	expenseAmount: { color: "#111827", fontWeight: "bold", marginBottom: 4 },
	expenseTime: { color: "#9CA3AF", fontSize: 12 },
	emptyState: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 80,
		paddingHorizontal: 40,
	},
	emptyIcon: {
		width: 80,
		height: 80,
		backgroundColor: "#F9FAFB",
		borderRadius: 40,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
	},
	emptyTitle: {
		color: "#6B7280",
		fontWeight: "500",
		textAlign: "center",
		fontSize: 18,
	},
	emptySubtitle: { color: "#9CA3AF", textAlign: "center", marginTop: 8 },
});
