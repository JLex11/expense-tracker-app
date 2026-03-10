import ExpenseForm from "@/components/expense-form";
import RecurrenceEditor from "@/components/recurrence-editor";
import { useCategories } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { createExpenseWithOptionalRecurrence } from "@/services/expenses";
import type {
  PaymentMethod,
  RecurrenceUnit,
  RecurringRuleInput,
} from "@/types/expenses";
import { View } from "@/tw";
import { parseRecurrenceInterval } from "@/utils/recurrence";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TransactScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale } = useI18n();
  const prefs = usePrefs();
  const categories = useCategories();

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [note, setNote] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceIntervalValue, setRecurrenceIntervalValue] = useState("1");
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("month");
  const [isSaving, setIsSaving] = useState(false);

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
