import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import { ScrollView, Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const METHOD_LABELS: Record<string, string> = {
	cash: "Cash",
	card: "Card",
	transfer: "Transfer",
};

const METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
	cash: "cash-outline",
	card: "card-outline",
	transfer: "swap-horizontal-outline",
};

export default function MovementDetailScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string | string[] }>();
	const movementId = Array.isArray(id) ? id[0] : id;

	const [expense, setExpense] = useState<Expense | null>(null);
	const [category, setCategory] = useState<Category | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!movementId) {
			setIsLoading(false);
			return;
		}

		let isMounted = true;

		const loadExpense = async () => {
			try {
				const foundExpense = await database
					.get<Expense>("expenses")
					.find(movementId);

				const foundCategory = await database
					.get<Category>("categories")
					.find(foundExpense.categoryId);

				if (isMounted) {
					setExpense(foundExpense);
					setCategory(foundCategory);
					setIsLoading(false);
				}
			} catch (error) {
				console.error("Failed to load movement", error);
				if (isMounted) {
					setExpense(null);
					setCategory(null);
					setIsLoading(false);
				}
			}
		};

		void loadExpense();

		return () => {
			isMounted = false;
		};
	}, [movementId]);

	const dateLabel = useMemo(() => {
		if (!expense) return "—";
		return new Date(expense.date).toLocaleDateString(undefined, {
			weekday: "short",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}, [expense]);

	const timeLabel = useMemo(() => {
		if (!expense) return "—";
		return new Date(expense.date).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	}, [expense]);

	const createdAtLabel = useMemo(() => {
		if (!expense?.createdAt) return "—";
		return new Date(expense.createdAt).toLocaleString();
	}, [expense]);

	const handleDelete = () => {
		if (!expense) return;

		Alert.alert("Delete movement", "This action cannot be undone.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					try {
						await database.write(async () => {
							await expense.destroyPermanently();
						});
						router.back();
					} catch (error) {
						console.error(error);
						Alert.alert("Error", "Could not delete movement.");
					}
				},
			},
		]);
	};

	if (isLoading) {
		return (
			<View
				className="flex-1 items-center justify-center bg-white"
				style={{ paddingTop: insets.top }}
			>
				<ActivityIndicator size="large" color="#3b82f6" />
				<Text className="mt-3 font-medium text-gray-500">
					Loading movement...
				</Text>
			</View>
		);
	}

	if (!expense) {
		return (
			<View
				className="flex-1 items-center justify-center bg-white px-6"
				style={{ paddingTop: insets.top }}
			>
				<View className="items-center justify-center w-20 h-20 mb-4 rounded-full bg-gray-100">
					<Ionicons name="alert-circle-outline" size={42} color="#9ca3af" />
				</View>
				<Text className="text-xl font-bold text-gray-900">
					Movement not found
				</Text>
				<Text className="mt-2 text-center text-gray-500">
					The selected movement is not available anymore.
				</Text>
				<TouchableOpacity
					onPress={() => router.back()}
					className="mt-6 rounded-2xl bg-primary px-5 py-3"
				>
					<Text className="font-semibold text-white">Go back</Text>
				</TouchableOpacity>
			</View>
		);
	}

	const method = expense.paymentMethod || "card";
	const methodLabel = METHOD_LABELS[method] ?? "Other";
	const methodIcon = METHOD_ICONS[method] ?? "card-outline";

	return (
		<ScrollView
			className="flex-1 bg-white"
			contentContainerStyle={{
				paddingTop: insets.top + 12,
				paddingHorizontal: 20,
				paddingBottom: 36,
			}}
		>
			<View className="mb-4 flex-row items-center justify-between">
				<TouchableOpacity
					onPress={() => router.back()}
					className="h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white"
				>
					<Ionicons name="chevron-back" size={22} color="#111827" />
				</TouchableOpacity>
				<Text className="text-lg font-bold text-gray-900">
					Movement details
				</Text>
				<View className="h-11 w-11" />
			</View>

			<View className="mb-6 items-center rounded-3xl border border-red-100 bg-red-50 p-6">
				<Text className="mb-2 text-sm font-semibold uppercase tracking-[1.5px] text-red-400">
					Amount
				</Text>
				<Text className="text-5xl font-extrabold text-red-600">
					-${expense.amount.toFixed(2)}
				</Text>
			</View>

			<View className="mb-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
				<Text className="mb-4 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
					Category
				</Text>
				<View className="flex-row items-center">
					<View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
						<Ionicons
							name={
								(category?.icon ||
									"help-circle") as keyof typeof Ionicons.glyphMap
							}
							size={24}
							color="#f59e0b"
						/>
					</View>
					<View>
						<Text className="text-lg font-bold text-gray-900">
							{category?.name || "Unknown"}
						</Text>
						<Text className="text-xs text-gray-500">Category assigned</Text>
					</View>
				</View>
			</View>

			<View className="mb-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
				<Text className="mb-4 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
					Movement info
				</Text>
				<View className="gap-4">
					<View className="flex-row items-center justify-between">
						<Text className="font-medium text-gray-600">Date</Text>
						<Text className="font-semibold text-gray-900">{dateLabel}</Text>
					</View>
					<View className="flex-row items-center justify-between">
						<Text className="font-medium text-gray-600">Time</Text>
						<Text className="font-semibold text-gray-900">{timeLabel}</Text>
					</View>
					<View className="flex-row items-center justify-between">
						<Text className="font-medium text-gray-600">Payment</Text>
						<View className="flex-row items-center gap-2">
							<Ionicons name={methodIcon} size={18} color="#374151" />
							<Text className="font-semibold text-gray-900">{methodLabel}</Text>
						</View>
					</View>
					<View className="flex-row items-center justify-between">
						<Text className="font-medium text-gray-600">Registered</Text>
						<Text className="max-w-[62%] text-right font-semibold text-gray-900">
							{createdAtLabel}
						</Text>
					</View>
				</View>
			</View>

			<View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-5">
				<Text className="mb-4 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
					Notes
				</Text>
				<Text className="text-base leading-6 text-gray-800">
					{expense.note?.trim()
						? expense.note
						: "No note added for this movement."}
				</Text>
			</View>

			<View className="mb-8 rounded-3xl border border-gray-100 bg-gray-50 p-5">
				<Text className="mb-3 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
					Tech info
				</Text>
				<Text selectable className="font-mono text-xs text-gray-500">
					ID: {expense.id}
				</Text>
			</View>

			<TouchableOpacity
				onPress={handleDelete}
				className="items-center rounded-2xl border border-red-200 bg-red-50 py-4"
			>
				<Text className="font-semibold text-red-600">Delete movement</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}
