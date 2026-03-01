import RecurrenceEditor from "@/components/recurrence-editor";
import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import type RecurringExpenseRule from "@/database/models/RecurringExpenseRule";
import {
	confirmPendingExpense,
	convertExpenseToRecurring,
	skipPendingExpense,
	toggleRecurringRule,
	updateRecurringRule,
} from "@/services/expenses";
import type { RecurrenceUnit, RecurringRuleInput } from "@/types/expenses";
import { ScrollView, Text, TouchableOpacity, View } from "@/tw";
import { formatRecurrenceSummary, parseRecurrenceInterval } from "@/utils/recurrence";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const STATUS_META = {
	confirmed: {
		label: "Confirmado",
		badgeClassName: "bg-emerald-100 text-emerald-700",
		cardClassName: "border-red-100 bg-red-50",
		amountClassName: "text-red-600",
	},
	pending: {
		label: "Pendiente",
		badgeClassName: "bg-amber-100 text-amber-700",
		cardClassName: "border-amber-100 bg-amber-50",
		amountClassName: "text-amber-700",
	},
	skipped: {
		label: "Omitido",
		badgeClassName: "bg-slate-200 text-slate-700",
		cardClassName: "border-slate-200 bg-slate-100",
		amountClassName: "text-slate-700",
	},
} as const;

export default function MovementDetailScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string | string[] }>();
	const movementId = Array.isArray(id) ? id[0] : id;

	const [expense, setExpense] = useState<Expense | null>(null);
	const [category, setCategory] = useState<Category | null>(null);
	const [recurringRule, setRecurringRule] = useState<RecurringExpenseRule | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isSavingRule, setIsSavingRule] = useState(false);
	const [isResolvingPending, setIsResolvingPending] = useState(false);
	const [isEditingRecurrence, setIsEditingRecurrence] = useState(false);
	const [recurrenceIntervalValue, setRecurrenceIntervalValue] = useState("1");
	const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("month");

	const loadMovement = useCallback(async () => {
		if (!movementId) {
			setExpense(null);
			setCategory(null);
			setRecurringRule(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		try {
			const foundExpense = await database.get<Expense>("expenses").find(movementId);
			const [foundCategory, foundRule] = await Promise.all([
				database.get<Category>("categories").find(foundExpense.categoryId),
				foundExpense.recurringRuleId
					? database
							.get<RecurringExpenseRule>("recurring_expense_rules")
							.find(foundExpense.recurringRuleId)
					: Promise.resolve(null),
			]);

			setExpense(foundExpense);
			setCategory(foundCategory);
			setRecurringRule(foundRule);
		} catch (error) {
			console.error("Failed to load movement", error);
			setExpense(null);
			setCategory(null);
			setRecurringRule(null);
		} finally {
			setIsLoading(false);
		}
	}, [movementId]);

	useEffect(() => {
		void loadMovement();
	}, [loadMovement]);

	useEffect(() => {
		if (!recurringRule) {
			setRecurrenceIntervalValue("1");
			setRecurrenceUnit("month");
			return;
		}

		setRecurrenceIntervalValue(String(recurringRule.intervalValue));
		setRecurrenceUnit(recurringRule.intervalUnit);
	}, [recurringRule]);

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
		if (!expense?.createdAt || expense.createdAt.getTime() <= 0) return "—";
		return new Date(expense.createdAt).toLocaleString();
	}, [expense]);

	const statusMeta = expense ? STATUS_META[expense.status] : STATUS_META.confirmed;
	const method = expense?.paymentMethod || "card";
	const methodLabel = METHOD_LABELS[method] ?? "Other";
	const methodIcon = METHOD_ICONS[method] ?? "card-outline";
	const recurrenceSummary = recurringRule
		? formatRecurrenceSummary(
				recurringRule.intervalValue,
				recurringRule.intervalUnit,
			)
		: null;
	const canConvertToRecurring =
		expense?.status === "confirmed" && !recurringRule;

	const buildRecurrenceInput = useCallback((): RecurringRuleInput | null => {
		const parsedInterval = parseRecurrenceInterval(recurrenceIntervalValue);

		if (!parsedInterval) {
			Alert.alert("Error", "Ingresa un intervalo válido para la recurrencia.");
			return null;
		}

		return {
			intervalValue: parsedInterval,
			intervalUnit: recurrenceUnit,
		};
	}, [recurrenceIntervalValue, recurrenceUnit]);

	const handleDelete = useCallback(() => {
		if (!expense || expense.status === "pending") return;

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
	}, [expense, router]);

	const handleConfirmPending = useCallback(async () => {
		if (!expense) return;

		setIsResolvingPending(true);
		try {
			await confirmPendingExpense(expense.id);
			await loadMovement();
		} catch (error) {
			console.error(error);
			Alert.alert("Error", "No se pudo confirmar este gasto.");
		} finally {
			setIsResolvingPending(false);
		}
	}, [expense, loadMovement]);

	const handleSkipPending = useCallback(async () => {
		if (!expense) return;

		setIsResolvingPending(true);
		try {
			await skipPendingExpense(expense.id);
			await loadMovement();
		} catch (error) {
			console.error(error);
			Alert.alert("Error", "No se pudo omitir este gasto.");
		} finally {
			setIsResolvingPending(false);
		}
	}, [expense, loadMovement]);

	const handleSaveRecurring = useCallback(async () => {
		if (!expense) return;

		const recurrence = buildRecurrenceInput();
		if (!recurrence) return;

		setIsSavingRule(true);
		try {
			if (recurringRule) {
				await updateRecurringRule(recurringRule.id, recurrence);
			} else {
				await convertExpenseToRecurring(expense.id, recurrence);
			}

			setIsEditingRecurrence(false);
			await loadMovement();
		} catch (error) {
			console.error(error);
			Alert.alert("Error", "No se pudo guardar la recurrencia.");
		} finally {
			setIsSavingRule(false);
		}
	}, [buildRecurrenceInput, expense, loadMovement, recurringRule]);

	const handleToggleRecurringRule = useCallback(async () => {
		if (!recurringRule) return;

		setIsSavingRule(true);
		try {
			await toggleRecurringRule(recurringRule.id, !recurringRule.isActive);
			await loadMovement();
		} catch (error) {
			console.error(error);
			Alert.alert("Error", "No se pudo actualizar la regla.");
		} finally {
			setIsSavingRule(false);
		}
	}, [loadMovement, recurringRule]);

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
				<View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
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

			<View className={`mb-6 rounded-3xl border p-6 ${statusMeta.cardClassName}`}>
				<View className="mb-4 flex-row items-center justify-between">
					<Text className="text-sm font-semibold uppercase tracking-[1.5px] text-gray-500">
						Amount
					</Text>
					<View className={`rounded-full px-3 py-1 ${statusMeta.badgeClassName}`}>
						<Text className="text-xs font-bold uppercase tracking-[1px]">
							{statusMeta.label}
						</Text>
					</View>
				</View>
				<Text className={`text-5xl font-extrabold ${statusMeta.amountClassName}`}>
					-${expense.amount.toFixed(2)}
				</Text>
				<Text className="mt-3 text-sm font-medium text-gray-500">
					{expense.origin === "recurring" ? "Gasto recurrente" : "Gasto manual"}
				</Text>
			</View>

			{expense.status === "pending" ? (
				<View className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
					<Text className="text-lg font-bold text-amber-900">
						¿Hiciste este gasto programado?
					</Text>
					<Text className="mt-2 text-sm leading-6 text-amber-800">
						Si ya lo pagaste, confírmalo para que entre en tu historial. Si no,
						márcalo como omitido y la recurrencia seguirá normalmente.
					</Text>
					<View className="mt-5 flex-row gap-3">
						<TouchableOpacity
							onPress={() => void handleConfirmPending()}
							disabled={isResolvingPending}
							className="flex-1 items-center rounded-2xl bg-primary py-3.5"
						>
							<Text className="font-bold text-white">
								{isResolvingPending ? "Guardando..." : "Sí, lo gasté"}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() => void handleSkipPending()}
							disabled={isResolvingPending}
							className="flex-1 items-center rounded-2xl border border-amber-300 bg-white py-3.5"
						>
							<Text className="font-semibold text-amber-800">No</Text>
						</TouchableOpacity>
					</View>
				</View>
			) : null}

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

			<View className="mb-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
				<Text className="mb-4 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
					Recurrencia
				</Text>

				{recurringRule ? (
					<>
						<View className="mb-4 flex-row items-start justify-between">
							<View className="flex-1 pr-4">
								<Text className="text-lg font-bold text-gray-900">
									{recurrenceSummary}
								</Text>
								<Text className="mt-1 text-sm leading-5 text-gray-500">
									Próximo cargo programado:{" "}
									{new Date(recurringRule.nextDueAt).toLocaleDateString()}
								</Text>
							</View>
							<View
								className={`rounded-full px-3 py-1 ${
									recurringRule.isActive
										? "bg-emerald-100"
										: "bg-slate-200"
								}`}
							>
								<Text
									className={`text-xs font-bold uppercase tracking-[1px] ${
										recurringRule.isActive
											? "text-emerald-700"
											: "text-slate-700"
									}`}
								>
									{recurringRule.isActive ? "Activa" : "Pausada"}
								</Text>
							</View>
						</View>

						{isEditingRecurrence ? (
							<>
								<RecurrenceEditor
									intervalValue={recurrenceIntervalValue}
									intervalUnit={recurrenceUnit}
									onChangeIntervalValue={setRecurrenceIntervalValue}
									onChangeIntervalUnit={setRecurrenceUnit}
									helperText="Los gastos ya generados se conservan; la nueva regla aplica a las próximas ocurrencias."
									disabled={isSavingRule}
								/>
								<View className="mt-4 flex-row gap-3">
									<TouchableOpacity
										onPress={() => void handleSaveRecurring()}
										disabled={isSavingRule}
										className="flex-1 items-center rounded-2xl bg-primary py-3.5"
									>
										<Text className="font-bold text-white">
											{isSavingRule ? "Guardando..." : "Guardar regla"}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={() => setIsEditingRecurrence(false)}
										disabled={isSavingRule}
										className="flex-1 items-center rounded-2xl border border-gray-200 bg-white py-3.5"
									>
										<Text className="font-semibold text-gray-700">Cancelar</Text>
									</TouchableOpacity>
								</View>
							</>
						) : (
							<View className="flex-row gap-3">
								<TouchableOpacity
									onPress={() => setIsEditingRecurrence(true)}
									className="flex-1 items-center rounded-2xl border border-gray-200 bg-white py-3.5"
								>
									<Text className="font-semibold text-gray-800">
										Editar recurrencia
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={() => void handleToggleRecurringRule()}
									disabled={isSavingRule}
									className="flex-1 items-center rounded-2xl border border-gray-200 bg-white py-3.5"
								>
									<Text className="font-semibold text-gray-800">
										{recurringRule.isActive ? "Pausar" : "Reactivar"}
									</Text>
								</TouchableOpacity>
							</View>
						)}
					</>
				) : canConvertToRecurring ? (
					<>
						<Text className="mb-4 text-sm leading-6 text-gray-500">
							Convierte este movimiento en la base de una recurrencia para que
							los próximos gastos se creen como pendientes.
						</Text>
						{isEditingRecurrence ? (
							<>
								<RecurrenceEditor
									intervalValue={recurrenceIntervalValue}
									intervalUnit={recurrenceUnit}
									onChangeIntervalValue={setRecurrenceIntervalValue}
									onChangeIntervalUnit={setRecurrenceUnit}
									helperText="Este gasto queda como el primero de la serie."
									disabled={isSavingRule}
								/>
								<View className="mt-4 flex-row gap-3">
									<TouchableOpacity
										onPress={() => void handleSaveRecurring()}
										disabled={isSavingRule}
										className="flex-1 items-center rounded-2xl bg-primary py-3.5"
									>
										<Text className="font-bold text-white">
											{isSavingRule ? "Guardando..." : "Crear recurrencia"}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={() => setIsEditingRecurrence(false)}
										disabled={isSavingRule}
										className="flex-1 items-center rounded-2xl border border-gray-200 bg-white py-3.5"
									>
										<Text className="font-semibold text-gray-700">Cancelar</Text>
									</TouchableOpacity>
								</View>
							</>
						) : (
							<TouchableOpacity
								onPress={() => setIsEditingRecurrence(true)}
								className="items-center rounded-2xl bg-primary py-3.5"
							>
								<Text className="font-bold text-white">
									Convertir en recurrente
								</Text>
							</TouchableOpacity>
						)}
					</>
				) : (
					<Text className="text-sm leading-6 text-gray-500">
						Este movimiento no tiene una regla recurrente disponible para editar.
					</Text>
				)}
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

			{expense.status !== "pending" ? (
				<TouchableOpacity
					onPress={handleDelete}
					className="items-center rounded-2xl border border-red-200 bg-red-50 py-4"
				>
					<Text className="font-semibold text-red-600">Delete movement</Text>
				</TouchableOpacity>
			) : null}
		</ScrollView>
	);
}
