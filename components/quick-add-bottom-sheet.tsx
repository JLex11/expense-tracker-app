import RecurrenceEditor from "@/components/recurrence-editor";
import { useQuickAdd } from "@/contexts/quick-add";
import { useCategories } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { createExpenseWithOptionalRecurrence } from "@/services/expenses";
import { Text, TouchableOpacity, View } from "@/tw";
import type { PaymentMethod, RecurrenceUnit, RecurringRuleInput } from "@/types/expenses";
import { getCurrencySymbol } from "@/utils/currency";
import { parseRecurrenceInterval } from "@/utils/recurrence";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Switch,
    TextInput,
} from "react-native";
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;
const PAYMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
	cash: "cash-outline",
	card: "card-outline",
	transfer: "swap-horizontal-outline",
};

export default function QuickAddDialog() {
	const { visible, close } = useQuickAdd();
	const router = useRouter();
	const amountRef = useRef<TextInput>(null);
	const { t, locale } = useI18n();
	const prefs = usePrefs();
	const categories = useCategories();

	const [step, setStep] = useState(0);
	const [amount, setAmount] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [date, setDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [note, setNote] = useState("");
	const [isRecurring, setIsRecurring] = useState(false);
	const [recurrenceIntervalValue, setRecurrenceIntervalValue] = useState("1");
	const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("month");
	const contentHeight = useSharedValue(0);
	const steps = [t("quickStepAmount"), t("quickStepCategory"), t("quickStepDetails")];

	const animatedContainerStyle = useAnimatedStyle(() => ({
		height: contentHeight.value === 0 ? undefined : contentHeight.value,
		overflow: "hidden" as const,
	}));

	const handleContentLayout = useCallback(
		(e: { nativeEvent: { layout: { height: number } } }) => {
			const h = e.nativeEvent.layout.height;
			if (contentHeight.value === 0) {
				contentHeight.value = h;
			} else {
				contentHeight.value = withTiming(h, { duration: 80 });
			}
		},
		[contentHeight],
	);

	useEffect(() => {
		if (visible) {
			setTimeout(() => amountRef.current?.focus(), 300);
		}
	}, [visible]);

	const resetAndClose = useCallback(() => {
		Keyboard.dismiss();
		close();
		setTimeout(() => {
			setStep(0);
			setAmount("");
			setPaymentMethod("card");
			setSelectedCategory(null);
			setDate(new Date());
			setNote("");
			setIsRecurring(false);
			setRecurrenceIntervalValue("1");
			setRecurrenceUnit("month");
			setShowDatePicker(false);
		}, 200);
	}, [close]);

	const goNext = useCallback(() => {
		if (step === 0) {
			if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
				Alert.alert(t("error"), t("enterValidAmountGreaterThanZero"));
				return;
			}
		}
		if (step === 1 && !selectedCategory) {
			Alert.alert(t("error"), t("selectCategoryError"));
			return;
		}
		Keyboard.dismiss();
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setStep((s) => Math.min(s + 1, steps.length - 1));
	}, [step, amount, selectedCategory, steps.length, t]);

	const goBack = useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setStep((s) => Math.max(s - 1, 0));
	}, []);

	const handleSelectCategory = useCallback((id: string) => {
		setSelectedCategory((prev) => (prev === id ? null : id));
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
	}, []);

	const handleSave = useCallback(async () => {
		if (!amount || Number(amount) <= 0) {
			Alert.alert(t("error"), t("enterValidAmount"));
			return;
		}
		if (!selectedCategory) {
			Alert.alert(t("error"), t("selectCategoryError"));
			return;
		}

		let recurrence: RecurringRuleInput | null = null;
		if (isRecurring) {
			const parsedInterval = parseRecurrenceInterval(recurrenceIntervalValue);
			if (!parsedInterval) {
				Alert.alert(t("error"), t("invalidRecurrenceInterval"));
				return;
			}

			recurrence = {
				intervalValue: parsedInterval,
				intervalUnit: recurrenceUnit,
			};
		}

		try {
			const { expenseId } = await createExpenseWithOptionalRecurrence({
				amount: Number(amount),
				categoryId: selectedCategory,
				date: date.getTime(),
				note,
				paymentMethod,
				recurrence,
			});

			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			resetAndClose();

			if (expenseId) {
				router.push({
					pathname: "/movement/[id]",
					params: { id: expenseId },
				});
			}
		} catch {
			Alert.alert(t("error"), t("saveExpenseError"));
		}
	}, [
		amount,
		selectedCategory,
		date,
		note,
		paymentMethod,
		isRecurring,
		recurrenceIntervalValue,
		recurrenceUnit,
		resetAndClose,
		router,
		t,
	]);

	const selectedCat = categories.find((c) => c.id === selectedCategory);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={resetAndClose}
		>
			<KeyboardAvoidingView
				style={styles.overlay}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<Pressable style={styles.backdrop} onPress={resetAndClose} />
				<View className="mx-3 mb-5 overflow-hidden bg-white rounded-3xl">
					<Animated.View style={animatedContainerStyle}>
						<View onLayout={handleContentLayout} style={styles.content}>
							{/* Header */}
							<View className="flex-row items-center justify-between mb-3">
								{step > 0 ? (
									<TouchableOpacity
										onPress={goBack}
										className="flex-row items-center"
									>
										<Ionicons name="chevron-back" size={20} color="#6b7280" />
										<Text className="ml-1 font-medium text-gray-500">
											{t("back")}
										</Text>
									</TouchableOpacity>
								) : (
									<View />
								)}
								<Text className="text-base font-bold text-gray-900">
									{steps[step]}
								</Text>
								<TouchableOpacity onPress={resetAndClose} hitSlop={8}>
									<Ionicons name="close" size={22} color="#9ca3af" />
								</TouchableOpacity>
							</View>

							{/* Progress dots */}
							<View className="flex-row items-center justify-center gap-2 mb-4">
								{steps.map((label, i) => (
									<View
										key={label}
										className={`h-1.5 rounded-full ${
											i === step
												? "w-8 bg-primary"
												: i < step
													? "w-2 bg-primary/40"
													: "w-2 bg-gray-200"
										}`}
									/>
								))}
							</View>

							{/* Step 0: Amount + Payment */}
							{step === 0 && (
								<Animated.View entering={FadeInDown.duration(250).springify()}>
									<View className="items-center mb-4">
											<View className="flex-row items-center pb-2 border-b border-gray-200">
												<Text className="mr-1 text-3xl font-bold text-gray-800">
													{getCurrencySymbol(prefs.currency)}
												</Text>
											<TextInput
												ref={amountRef}
												style={styles.amountInput}
												value={amount}
												onChangeText={setAmount}
												keyboardType="decimal-pad"
												placeholder="0.00"
												placeholderTextColor="#D1D5DB"
											/>
										</View>
									</View>

									<View className="flex-row justify-center gap-2 mb-4">
										{PAYMENT_METHODS.map((method) => {
											const active = paymentMethod === method;
											return (
												<TouchableOpacity
													key={method}
													onPress={() => setPaymentMethod(method)}
													className={`flex-row items-center gap-1.5 rounded-2xl px-4 py-2 ${
														active
															? "bg-primary"
															: "border border-gray-200 bg-gray-50"
													}`}
												>
													<Ionicons
														name={PAYMENT_ICONS[method]}
														size={16}
														color={active ? "white" : "#6b7280"}
													/>
													<Text
														className={`text-xs font-semibold capitalize ${
															active ? "text-white" : "text-gray-600"
														}`}
													>
														{method === "cash"
															? t("paymentCash")
															: method === "transfer"
																? t("paymentTransfer")
																: t("paymentCard")}
													</Text>
												</TouchableOpacity>
											);
										})}
									</View>

									<TouchableOpacity
										onPress={goNext}
										className="items-center py-3.5 mx-2 mt-2 rounded-2xl bg-primary"
										activeOpacity={0.8}
									>
										<Text className="text-base font-bold text-white">
											{t("next")}
										</Text>
									</TouchableOpacity>
								</Animated.View>
							)}

							{/* Step 1: Category */}
							{step === 1 && (
								<Animated.View entering={FadeInDown.duration(250).springify()}>
									<Text className="px-1 mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
										{t("selectCategoryPrompt")}
									</Text>
									<FlatList
										data={categories}
										horizontal
										showsHorizontalScrollIndicator={false}
										contentContainerStyle={styles.categoryList}
										keyExtractor={(item) => item.id}
										renderItem={({ item }) => {
											const isSelected = selectedCategory === item.id;
											return (
												<TouchableOpacity
													onPress={() => handleSelectCategory(item.id)}
													className={`mx-1.5 items-center justify-center rounded-2xl border p-2.5 ${
														isSelected
															? "border-primary bg-primary"
															: "border-gray-100 bg-gray-50"
													}`}
													style={styles.categoryCard}
													activeOpacity={0.7}
												>
													<Ionicons
														name={item.icon as keyof typeof Ionicons.glyphMap}
														size={24}
														color={isSelected ? "white" : "#6B7280"}
													/>
													<Text
														className={`mt-1 text-[10px] font-semibold ${
															isSelected ? "text-white" : "text-gray-600"
														}`}
														numberOfLines={1}
													>
														{item.name}
													</Text>
												</TouchableOpacity>
											);
										}}
									/>

									<TouchableOpacity
										onPress={goNext}
										className="items-center py-3.5 mx-2 mt-4 rounded-2xl bg-primary"
										activeOpacity={0.8}
									>
										<Text className="text-base font-bold text-white">
											{t("next")}
										</Text>
									</TouchableOpacity>
								</Animated.View>
							)}

							{/* Step 2: Date + Note + Save */}
							{step === 2 && (
								<Animated.View entering={FadeInDown.duration(250).springify()}>
									<View className="flex-row gap-3 mb-3">
										<TouchableOpacity
											onPress={() => {
												Keyboard.dismiss();
												setShowDatePicker(true);
											}}
											className="flex-row items-center flex-1 gap-2 px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50"
										>
											<Ionicons
												name="calendar-outline"
												size={18}
												color="#6b7280"
											/>
											<Text className="font-medium text-gray-800">
												{date.toLocaleDateString(locale)}
											</Text>
										</TouchableOpacity>

										{selectedCat && (
											<View className="flex-row items-center gap-2 px-4 py-3 rounded-2xl bg-primary/10">
												<Ionicons
													name={
														selectedCat.icon as keyof typeof Ionicons.glyphMap
													}
													size={16}
													color="#0a7ea4"
												/>
												<Text className="text-sm font-semibold text-primary">
													{selectedCat.name}
												</Text>
											</View>
										)}
									</View>

									{showDatePicker && (
										<DateTimePicker
											value={date}
											mode="date"
											display="default"
											onChange={(_event, selectedDate) => {
												setShowDatePicker(false);
												if (selectedDate) setDate(selectedDate);
											}}
										/>
									)}

									<TextInput
										style={styles.noteInput}
										placeholder={t("addNotePlaceholder")}
										placeholderTextColor="#9CA3AF"
										value={note}
										onChangeText={setNote}
									/>

									<View className="p-4 mt-3 border border-gray-200 rounded-2xl bg-gray-50">
										<View className="flex-row items-center justify-between mb-4">
											<View className="flex-1 mr-4">
												<Text className="font-semibold text-gray-900">
													{t("recurringExpense")}
												</Text>
												<Text className="mt-1 text-sm leading-5 text-gray-500">
													{t("recurringExpenseHelp")}
												</Text>
											</View>
											<Switch
												value={isRecurring}
												onValueChange={setIsRecurring}
											/>
										</View>

										{isRecurring ? (
											<RecurrenceEditor
												intervalValue={recurrenceIntervalValue}
												intervalUnit={recurrenceUnit}
												onChangeIntervalValue={setRecurrenceIntervalValue}
												onChangeIntervalUnit={setRecurrenceUnit}
												helperText={t("recurringExpenseHelperCurrent")}
											/>
										) : null}
									</View>

									<View className="flex-row items-center justify-between px-2 mt-3 mb-3">
										<Text className="text-sm text-gray-500">{t("total")}</Text>
										<Text className="text-2xl font-bold text-gray-900">
											{getCurrencySymbol(prefs.currency)}
											{Number(amount || 0).toFixed(2)}
										</Text>
									</View>

									<TouchableOpacity
										onPress={handleSave}
										className="items-center py-3.5 mx-2 rounded-2xl bg-primary"
										activeOpacity={0.8}
									>
										<Text className="text-base font-bold text-white">
											{t("saveExpense")}
										</Text>
									</TouchableOpacity>
								</Animated.View>
							)}
						</View>
					</Animated.View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "flex-end",
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.4)",
	},
	content: {
		padding: 16,
	},
	amountInput: {
		fontSize: 32,
		fontWeight: "bold",
		color: "#1f2937",
		textAlign: "center",
		minWidth: 100,
		padding: 0,
	},
	categoryList: {
		paddingHorizontal: 4,
		paddingVertical: 4,
	},
	categoryCard: {
		width: 68,
		height: 68,
	},
	noteInput: {
		backgroundColor: "#f9fafb",
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 16,
		padding: 14,
		fontSize: 15,
		color: "#1f2937",
	},
});
