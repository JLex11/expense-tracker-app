import { useI18n } from "@/hooks/useI18n";
import type { RecurrenceUnit } from "@/types/expenses";
import { Text, TextInput, TouchableOpacity, View } from "@/tw";
import { RECURRENCE_UNITS, formatRecurrenceSummary } from "@/utils/recurrence";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable } from "react-native";

interface RecurrenceEditorProps {
  intervalValue: string;
  intervalUnit: RecurrenceUnit;
  onChangeIntervalValue: (value: string) => void;
  onChangeIntervalUnit: (unit: RecurrenceUnit) => void;
  helperText?: string;
  disabled?: boolean;
}

export default function RecurrenceEditor({
  intervalValue,
  intervalUnit,
  onChangeIntervalValue,
  onChangeIntervalUnit,
  helperText,
  disabled = false,
}: RecurrenceEditorProps) {
  const { language, t } = useI18n();
  const [open, setOpen] = useState(false);

  const summaryValue = Number.parseInt(intervalValue, 10);
  const unitLabels: Record<RecurrenceUnit, string> = {
    day: t("recurrenceDay"),
    week: t("recurrenceWeek"),
    month: t("recurrenceMonth"),
    year: t("recurrenceYear"),
  };

  return (
    <View className="border-t border-gray-200 bg-gray-50 py-4">
      <Text className="mb-3 text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
        {t("recurrence")}
      </Text>

      <View className="mb-3 flex-row items-center gap-3">
        {/* Numeric input */}
        <View className="w-20 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
          <TextInput
            value={intervalValue}
            onChangeText={onChangeIntervalValue}
            keyboardType="number-pad"
            editable={!disabled}
            className="p-0 text-lg font-bold text-gray-900"
          />
        </View>

        {/* Custom select */}
        <TouchableOpacity
          onPress={() => !disabled && setOpen(true)}
          activeOpacity={0.7}
          className="flex-1 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
        >
          <Text className="text-base font-semibold text-gray-800">
            {unitLabels[intervalUnit]}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {summaryValue > 0 && (
        <Text className="mb-1 text-sm font-semibold text-gray-700">
          {formatRecurrenceSummary(summaryValue, intervalUnit, language)}
        </Text>
      )}

      {helperText ? (
        <Text className="text-sm leading-5 text-gray-500">{helperText}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
          onPress={() => setOpen(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="rounded-t-3xl bg-white px-4 pb-10 pt-4">
              {/* Handle bar */}
              <View className="mb-4 self-center w-10 h-1 rounded-full bg-gray-200" />

              {RECURRENCE_UNITS.map((unit, i) => {
                const isActive = unit === intervalUnit;
                const isLast = i === RECURRENCE_UNITS.length - 1;
                return (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => {
                      onChangeIntervalUnit(unit);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    className={`flex-row items-center justify-between px-2 py-4 ${!isLast ? "border-b border-gray-100" : ""}`}
                  >
                    <Text
                      className={`text-base ${isActive ? "font-bold text-primary" : "font-medium text-gray-800"}`}
                    >
                      {unitLabels[unit]}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color="currentColor"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
