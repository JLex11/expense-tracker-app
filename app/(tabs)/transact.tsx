import ExpenseForm from "@/components/expense-form";
import RecurrenceEditor from "@/components/recurrence-editor";
import { useCategories } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { useReadyReceiptScanCount } from "@/hooks/useReceiptScanJobs";
import { useReceiptScannerFlow } from "@/hooks/useReceiptScannerFlow";
import { createExpenseWithOptionalRecurrence } from "@/services/expenses";
import type {
  PaymentMethod,
  RecurrenceUnit,
  RecurringRuleInput,
} from "@/types/expenses";
import { Text, TouchableOpacity, View } from "@/tw";
import { parseRecurrenceInterval } from "@/utils/recurrence";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TransactScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recurring, scanReceipt } = useLocalSearchParams<{
    recurring?: string | string[];
    scanReceipt?: string | string[];
  }>();
  const { t, locale } = useI18n();
  const prefs = usePrefs();
  const categories = useCategories();
  const readyReceiptCount = useReadyReceiptScanCount();
  const { isScanningReceipt, startReceiptScan } = useReceiptScannerFlow();
  const hasAutoOpenedReceiptScanRef = useRef(false);

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [note, setNote] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceIntervalValue, setRecurrenceIntervalValue] = useState("1");
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("month");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const raw = Array.isArray(recurring) ? recurring[0] : recurring;
    if (raw === "1" || raw === "true") {
      setIsRecurring(true);
    }
  }, [recurring]);

  useEffect(() => {
    const raw = Array.isArray(scanReceipt) ? scanReceipt[0] : scanReceipt;
    if ((raw === "1" || raw === "true") && !hasAutoOpenedReceiptScanRef.current) {
      hasAutoOpenedReceiptScanRef.current = true;
      void startReceiptScan();
    }
  }, [scanReceipt, startReceiptScan]);

  const isFormValid =
    !!amount &&
    !Number.isNaN(Number(amount)) &&
    Number(amount) > 0 &&
    !!selectedCategory &&
    (!isRecurring || !!parseRecurrenceInterval(recurrenceIntervalValue));

  const handleSave = async () => {
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert(t("error"), t("enterValidAmountGreaterThanZero"));
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

    setIsSaving(true);
    try {
      const { expenseId } = await createExpenseWithOptionalRecurrence({
        amount: Number(amount),
        categoryId: selectedCategory,
        date: date.getTime(),
        note,
        paymentMethod,
        recurrence,
      });

      setAmount("");
      setNote("");
      setSelectedCategory(null);
      setDate(new Date());
      setPaymentMethod("card");
      setIsRecurring(false);
      setRecurrenceIntervalValue("1");
      setRecurrenceUnit("month");

      if (expenseId) {
        router.push({
          pathname: "/movement/[id]",
          params: { id: expenseId },
        });
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t("error"), t("saveExpenseError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 20 }}>
      <View className="flex-row items-center gap-2 px-5 pb-2">
        <TouchableOpacity
          className="min-h-11 flex-1 flex-row items-center justify-center rounded-2xl bg-gray-950 px-4"
          onPress={() => void startReceiptScan()}
          disabled={isScanningReceipt}
        >
          {isScanningReceipt ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="scan-outline" size={18} color="#ffffff" />
              <Text className="ml-2 text-sm font-bold text-white">
                {t("scanReceipt")}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className="relative min-h-11 flex-row items-center justify-center rounded-2xl bg-gray-100 px-4"
          onPress={() => router.push("/receipts" as any)}
        >
          <Ionicons name="receipt-outline" size={18} color="#111827" />
          {readyReceiptCount > 0 && (
            <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1">
              <Text className="text-[11px] font-bold text-white">
                {readyReceiptCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <ExpenseForm
        mode="create"
        currency={prefs.currency}
        locale={locale}
        extraBottomPadding={insets.bottom + 50}
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
        isRecurring={isRecurring}
        onChangeIsRecurring={setIsRecurring}
        recurrenceEditor={
          <RecurrenceEditor
            intervalValue={recurrenceIntervalValue}
            intervalUnit={recurrenceUnit}
            onChangeIntervalValue={setRecurrenceIntervalValue}
            onChangeIntervalUnit={setRecurrenceUnit}
            helperText={t("recurringExpenseHelperCurrent")}
          />
        }
        onSubmit={handleSave}
        submitDisabled={isSaving || !isFormValid}
        showRecurringToggle
      />
    </View>
  );
}
