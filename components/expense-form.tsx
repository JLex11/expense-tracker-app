import React from "react";
import type { PaymentMethod } from "@/types/expenses";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { getCurrencySymbol } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
} from "react-native";

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
};

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "transfer"];

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
}: ExpenseFormProps) {
  const submitLabel = mode === "edit" ? labels.saveChanges : labels.saveExpense;

  const handleAmountChange = (text: string) => {
    const raw = parseAmountInput(text);
    onChangeAmount(raw);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
      >
        <View className="items-center mb-10 mt-4">
          <Text className="mb-2 text-base font-medium tracking-[1px] text-gray-400">
            {labels.amount}
          </Text>
          <View className="flex-row items-center pb-2 border-b border-gray-200">
            <Text className="mr-2 text-5xl font-bold text-gray-800">
              {getCurrencySymbol(currency)}
            </Text>
            <TextInput
              className="min-w-25 p-0 text-center text-[56px] font-bold text-gray-800"
              value={formatAmountDisplay(amount)}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#D1D5DB"
            />
          </View>
        </View>

        <View className="mb-8">
          <Text className="mb-4 pl-1 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
            {labels.category}
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => onSelectCategory(cat.id)}
                  className={`aspect-square w-[30%] items-center justify-center rounded-3xl border p-4 ${
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

        <View className="mb-8">
          <Text className="mb-4 pl-1 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
            {labels.details}
          </Text>

          <View className="p-5 mb-4 border border-gray-100 rounded-3xl bg-gray-50">
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-gray-600">{labels.date}</Text>
              <View className="px-4 py-2 bg-white border border-gray-100 rounded-xl">
                <DateInputButton
                  value={date}
                  locale={locale}
                  onChange={onChangeDate}
                />
              </View>
            </View>

            <View className="pt-5 mt-5 border-t border-gray-200">
              <View className="flex-row items-center justify-between">
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
                        className={`rounded-lg px-4 py-2 ${isActive ? "bg-white" : ""}`}
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
            <View className="mt-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <View className="mb-4 flex-row items-center justify-between">
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
      </ScrollView>

      <View className="px-5 pb-8 pt-4 bg-white border-t border-gray-100">
        <TouchableOpacity
          className={`items-center py-5 rounded-3xl ${
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
