import ExpenseForm from "@/components/expense-form";
import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { updateExpense } from "@/services/expenses";
import type { PaymentMethod } from "@/types/expenses";
import { Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type EditableExpense = {
  id: string;
  amount: number;
  categoryId: string;
  date: number;
  note: string;
  paymentMethod: PaymentMethod;
  status: string;
};

export default function EditMovementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale } = useI18n();
  const prefs = usePrefs();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const movementId = Array.isArray(id) ? id[0] : id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [originalExpense, setOriginalExpense] =
    useState<EditableExpense | null>(null);

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [note, setNote] = useState("");

  const loadData = useCallback(async () => {
    if (!movementId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [expense, allCategories] = await Promise.all([
        database.get<Expense>("expenses").find(movementId),
        database.get<Category>("categories").query().fetch(),
      ]);

      setCategories(
        [...allCategories].sort((a, b) => a.name.localeCompare(b.name)),
      );

      const editable: EditableExpense = {
        id: expense.id,
        amount: expense.amount,
        categoryId: expense.categoryId,
        date: expense.date,
        note: expense.note ?? "",
        paymentMethod: (expense.paymentMethod as PaymentMethod) ?? "card",
        status: expense.status,
      };

      setOriginalExpense(editable);
      setAmount(String(Math.abs(editable.amount)));
      setSelectedCategory(editable.categoryId);
      setDate(new Date(editable.date));
      setPaymentMethod(editable.paymentMethod);
      setNote(editable.note);
    } catch (error) {
      console.error("Failed to load expense for edit", error);
      Alert.alert(t("error"), t("movementNotFoundBody"));
    } finally {
      setIsLoading(false);
    }
  }, [movementId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitDisabled = useMemo(
    () => isSaving || isLoading || !originalExpense,
    [isSaving, isLoading, originalExpense],
  );

  const handleSave = async () => {
    if (!originalExpense) return;

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert(t("error"), t("enterValidAmountGreaterThanZero"));
      return;
    }

    if (!selectedCategory) {
      Alert.alert(t("error"), t("selectCategoryError"));
      return;
    }

    setIsSaving(true);
    try {
      await updateExpense(originalExpense.id, {
        amount: Number(amount),
        categoryId: selectedCategory,
        date: date.getTime(),
        note,
        paymentMethod,
      });

      router.replace({
        pathname: "/movement/[id]",
        params: { id: originalExpense.id, updated: "1" },
      });
    } catch (error) {
      console.error(error);
      Alert.alert(t("error"), t("saveExpenseError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-white"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-3 font-medium text-gray-500">
          {t("loading")}...
        </Text>
      </View>
    );
  }

  if (!originalExpense) {
    return (
      <View
        className="flex-1 items-center justify-center bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        <View className="w-full max-w-sm items-center rounded-3xl border border-gray-100 bg-gray-50 p-6">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-200/70">
            <Ionicons name="alert-circle-outline" size={32} color="#6b7280" />
          </View>
          <Text className="text-center text-xl font-bold text-gray-900">
            {t("movementNotFound")}
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            {t("movementNotFoundBody")}
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 w-full items-center rounded-2xl bg-primary px-4 py-3"
          >
            <Text className="font-semibold text-white">{t("goBack")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 8 }}>
      <ExpenseForm
        mode="edit"
        currency={prefs.currency}
        locale={locale}
        labels={{
          amount: t("amount"),
          category: t("category"),
          details: t("details"),
          date: t("date"),
          method: t("method"),
          notePlaceholder: t("addNotePlaceholder"),
          recurringExpense: t("recurringExpense"),
          recurringExpenseHelp: t("recurringExpenseHelp"),
          paymentCash: t("paymentCash"),
          paymentCard: t("paymentCard"),
          paymentTransfer: t("paymentTransfer"),
          saveExpense: t("saveExpense"),
          saveChanges: t("saveChanges"),
        }}
        categories={categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
        }))}
        amount={amount}
        onChangeAmount={setAmount}
        selectedCategoryId={selectedCategory}
        onSelectCategory={setSelectedCategory}
        date={date}
        onChangeDate={setDate}
        paymentMethod={paymentMethod}
        onChangePaymentMethod={setPaymentMethod}
        note={note}
        onChangeNote={setNote}
        isRecurring={false}
        onChangeIsRecurring={() => {}}
        onSubmit={handleSave}
        submitDisabled={submitDisabled}
        showRecurringToggle={false}
      />
    </View>
  );
}
