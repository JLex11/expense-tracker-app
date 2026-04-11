import { Text, TextInput, TouchableOpacity, View } from "@/tw";
import type { PaymentMethod } from "@/types/expenses";
import { getCurrencySymbol } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Switch,
    TextInput as RNTextInput,
    useWindowDimensions,
} from "react-native";
import Animated, {
    interpolate,
    useAnimatedRef,
    useAnimatedStyle,
    useDerivedValue,
    useScrollOffset,
} from "react-native-reanimated";

type ExpenseCategory = {
	id: string;
	name: string;
	icon: string;
};

type ExpenseFormMode = "create" | "edit";

type ExpenseFormLabels = {
	amount: string;
	category: string;
	details: string;
	date: string;
	method: string;
	notePlaceholder: string;
	recurringExpense: string;
	recurringExpenseHelp: string;
	paymentCash: string;
	paymentCard: string;
	paymentTransfer: string;
	saveExpense: string;
	saveChanges: string;
};

type ExpenseFormProps = {
	mode: ExpenseFormMode;
	currency: string;
	locale: string;
	labels: ExpenseFormLabels;
	categories: ExpenseCategory[];
	amount: string;
	onChangeAmount: (value: string) => void;
	selectedCategoryId: string | null;
	onSelectCategory: (categoryId: string) => void;
	date: Date;
	onChangeDate: (date: Date) => void;
	paymentMethod: PaymentMethod;
	onChangePaymentMethod: (method: PaymentMethod) => void;
	note: string;
	onChangeNote: (note: string) => void;
	isRecurring: boolean;
	onChangeIsRecurring: (value: boolean) => void;
	recurrenceEditor?: React.ReactNode;
	onSubmit: () => void;
	submitDisabled?: boolean;
	showRecurringToggle?: boolean;
	extraBottomPadding?: number;
};

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "transfer"];

const EXPANDED_HEIGHT = 140;
const COLLAPSED_HEIGHT = 52;
const SCROLL_THRESHOLD = 80;
const AnimatedTextInput = Animated.createAnimatedComponent(RNTextInput);

/**
 * Formats a raw numeric string (e.g. "1234567.89") into a display string
 * with thousands separators (e.g. "1,234,567.89").
 * The decimal part is preserved as-is so the user can keep typing decimals.
 */
function formatAmountDisplay(raw: string): string {
	if (!raw) return raw;
	const [intPart, decPart] = raw.split(".");
	const formattedInt = (intPart ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

/**
 * Strips thousands separators from a formatted string and sanitizes it so
 * only digits and a single decimal point remain (raw numeric string).
 */
function parseAmountInput(text: string): string {
	// Remove thousands separators
	const stripped = text.replace(/,/g, "");
	// Keep only digits and decimal point
	const sanitized = stripped.replace(/[^0-9.]/g, "");
	// Ensure at most one decimal point
	const parts = sanitized.split(".");
	if (parts.length > 2) {
		return parts[0] + "." + parts.slice(1).join("");
	}
	return sanitized;
}

export default function ExpenseForm({
	mode,
	currency,
	locale,
	labels,
	categories,
	amount,
	onChangeAmount,
	selectedCategoryId,
	onSelectCategory,
	date,
	onChangeDate,
	paymentMethod,
	onChangePaymentMethod,
	note,
	onChangeNote,
	isRecurring,
	onChangeIsRecurring,
	recurrenceEditor,
	onSubmit,
	submitDisabled = false,
	showRecurringToggle = true,
	extraBottomPadding = 0,
}: ExpenseFormProps) {
	const submitLabel = mode === "edit" ? labels.saveChanges : labels.saveExpense;
	const { width: windowWidth } = useWindowDimensions();
	const symbol = getCurrencySymbol(currency);
	const amountDisplay = formatAmountDisplay(amount);
	const contentWidth = Math.max(windowWidth, 0);
	const collapsedRowWidth = Math.min(180, contentWidth);

	const handleAmountChange = (text: string) => {
		const raw = parseAmountInput(text);
		onChangeAmount(raw);
	};

	const scrollRef = useAnimatedRef<Animated.ScrollView>();
	const scrollOffset = useScrollOffset(scrollRef);
	const progress = useDerivedValue(() =>
		interpolate(
			scrollOffset.value,
			[0, SCROLL_THRESHOLD],
			[0, 1],
			"clamp",
		),
	);

	const backgroundAnimatedStyle = useAnimatedStyle(() => ({
		height: interpolate(
			progress.value,
			[0, 1],
			[EXPANDED_HEIGHT, COLLAPSED_HEIGHT],
			"clamp",
		),
	}));

	const labelAnimatedStyle = useAnimatedStyle(() => {
		return {
			fontSize: interpolate(progress.value, [0, 1], [16, 12], "clamp"),
			letterSpacing: interpolate(progress.value, [0, 1], [1, 1], "clamp"),
			transform: [
				{
					translateX: interpolate(
						progress.value,
						[0, 1],
						[0, -(contentWidth / 2) + 20 + 40],
						"clamp",
					),
				},
				{
					translateY: interpolate(progress.value, [0, 1], [0, -10], "clamp"),
				},
			],
		};
	});

	const rowAnimatedStyle = useAnimatedStyle(() => {
		return {
			paddingRight: interpolate(
				progress.value,
				[0, 1],
				[(contentWidth - collapsedRowWidth) / 2, 20],
				"clamp",
			),
			transform: [
				{
					translateY: interpolate(progress.value, [0, 1], [0, -44], "clamp"),
				},
			],
		};
	});

	const symbolAnimatedStyle = useAnimatedStyle(() => {
		return {
			fontSize: interpolate(progress.value, [0, 1], [56, 22], "clamp"),
			lineHeight: interpolate(progress.value, [0, 1], [60, 26], "clamp"),
			marginRight: interpolate(progress.value, [0, 1], [8, 4], "clamp"),
		};
	});

	const inputAnimatedStyle = useAnimatedStyle(() => {
		return {
			fontSize: interpolate(progress.value, [0, 1], [56, 22], "clamp"),
			lineHeight: interpolate(progress.value, [0, 1], [60, 26], "clamp"),
		};
	});

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<View style={styles.formBody}>
				<View pointerEvents="box-none" style={styles.amountOverlay}>
					<Animated.View style={[styles.amountBackground, backgroundAnimatedStyle]} />

					<Animated.Text style={[styles.amountLabel, labelAnimatedStyle]}>
						{labels.amount}
					</Animated.Text>

					<Animated.View style={[styles.amountRow, rowAnimatedStyle]}>
						<Animated.Text style={[styles.amountSymbol, symbolAnimatedStyle]}>
							{symbol}
						</Animated.Text>
						<AnimatedTextInput
							style={[styles.amountInput, inputAnimatedStyle]}
							value={amountDisplay}
							onChangeText={handleAmountChange}
							keyboardType="decimal-pad"
							placeholder="0.00"
							placeholderTextColor="#D1D5DB"
						/>
					</Animated.View>
				</View>

				<Animated.ScrollView
					ref={scrollRef}
					style={styles.scrollView}
					contentContainerStyle={{
						paddingTop: EXPANDED_HEIGHT,
						paddingBottom: 20,
						paddingHorizontal: 20,
					}}
					scrollEventThrottle={16}
				>
					<View>
						<View className="mb-4">
							<Text className="mb-4 pl-1 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
								{labels.category}
							</Text>

							<View className="flex-row flex-wrap gap-4">
								{categories.map((cat) => {
									const isSelected = selectedCategoryId === cat.id;
									return (
										<TouchableOpacity
											key={cat.id}
											onPress={() => onSelectCategory(cat.id)}
											className={`aspect-square w-[30%] items-center justify-center rounded-3xl border p-2 ${
												isSelected
													? "border-primary bg-primary"
													: "border-gray-100 bg-gray-50"
											}`}
											activeOpacity={0.7}
										>
											<Ionicons
												name={cat.icon as keyof typeof Ionicons.glyphMap}
												size={28}
												color={isSelected ? "white" : "#6B7280"}
											/>
											<Text
												className={`mt-1 text-xs font-semibold ${
													isSelected ? "text-white" : "text-gray-600"
												}`}
											>
												{cat.name}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>

						<View className="mb-4">
							<Text className="mb-4 pl-1 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
								{labels.details}
							</Text>

							<View className="p-5 mb-4 border border-gray-100 rounded-3xl bg-gray-50">
								<View className="flex-row items-center justify-between">
									<Text className="font-medium text-gray-600">
										{labels.date}
									</Text>
									<View className="px-4 py-2 bg-white border border-gray-100 rounded-xl">
										<DateInputButton
											value={date}
											locale={locale}
											onChange={onChangeDate}
										/>
									</View>
								</View>

								<View className="pt-5 mt-5 border-t border-gray-200">
									<View className="flex-row items-center justify-between gap-2">
										<Text className="font-medium text-gray-600">
											{labels.method}
										</Text>

										<View className="flex-row p-1 bg-gray-200 rounded-xl">
											{PAYMENT_METHODS.map((method) => {
												const isActive = paymentMethod === method;
												return (
													<TouchableOpacity
														key={method}
														onPress={() => onChangePaymentMethod(method)}
														className={`rounded-lg px-3 py-2 ${isActive ? "bg-white" : ""}`}
													>
														<Text
															className={`capitalize ${
																isActive
																	? "font-bold text-gray-800"
																	: "font-medium text-gray-500"
															}`}
														>
															{method === "cash"
																? labels.paymentCash
																: method === "transfer"
																	? labels.paymentTransfer
																	: labels.paymentCard}
														</Text>
													</TouchableOpacity>
												);
											})}
										</View>
									</View>
								</View>
							</View>

							<TextInput
								className="p-5 font-medium text-gray-800 border border-gray-100 rounded-3xl bg-gray-50"
								placeholder={labels.notePlaceholder}
								placeholderTextColor="#9CA3AF"
								value={note}
								onChangeText={onChangeNote}
							/>

							{showRecurringToggle ? (
								<View className="p-5 mt-4 border border-gray-100 rounded-3xl bg-gray-50">
									<View className="flex-row items-center justify-between mb-4">
										<View className="flex-1 pr-4">
											<Text className="font-semibold text-gray-900">
												{labels.recurringExpense}
											</Text>
											<Text className="mt-1 text-sm leading-5 text-gray-500">
												{labels.recurringExpenseHelp}
											</Text>
										</View>
										<Switch
											value={isRecurring}
											onValueChange={onChangeIsRecurring}
										/>
									</View>

									{isRecurring ? (recurrenceEditor ?? null) : null}
								</View>
							) : null}
						</View>
					</View>
				</Animated.ScrollView>
			</View>

			<View
				className="px-12 pt-2 bg-white border-t border-gray-100"
				style={{ paddingBottom: 26 + extraBottomPadding }}
			>
				<TouchableOpacity
					className={`items-center py-3 rounded-3xl ${
						submitDisabled ? "bg-gray-300" : "bg-primary"
					}`}
					onPress={onSubmit}
					disabled={submitDisabled}
					activeOpacity={0.8}
				>
					<Text className="text-lg font-bold text-white">{submitLabel}</Text>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",
	},
	formBody: {
		flex: 1,
		position: "relative",
	},
	scrollView: {
		flex: 1,
	},
	amountOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: EXPANDED_HEIGHT,
		zIndex: 10,
	},
	amountBackground: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		backgroundColor: "white",
		overflow: "hidden",
		borderBottomWidth: 1,
		borderBottomColor: "rgba(229, 231, 235, 1)",
	},
	amountLabel: {
		position: "absolute",
		top: 28,
		left: 20,
		right: 20,
		textAlign: "center",
		fontWeight: "500",
		color: "#9CA3AF",
	},
	amountRow: {
		position: "absolute",
		top: 60,
		left: 0,
		right: 0,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
	},
	amountSymbol: {
		color: "#1F2937",
		fontWeight: "700",
	},
	amountInput: {
		color: "#1F2937",
		fontWeight: "700",
		padding: 0,
		textAlign: "left",
	},
});

function DateInputButton({
	value,
	locale,
	onChange,
}: {
	value: Date;
	locale: string;
	onChange: (date: Date) => void;
}) {
	const [showDatePicker, setShowDatePicker] = React.useState(false);

	return (
		<>
			<TouchableOpacity onPress={() => setShowDatePicker(true)}>
				<Text className="font-semibold text-gray-800">
					{value.toLocaleDateString(locale)}
				</Text>
			</TouchableOpacity>

			{showDatePicker ? (
				<DateTimePicker
					value={value}
					mode="date"
					display={Platform.OS === "ios" ? "spinner" : "default"}
					onChange={(_event, selectedDate) => {
						setShowDatePicker(false);
						if (selectedDate) onChange(selectedDate);
					}}
				/>
			) : null}
		</>
	);
}
