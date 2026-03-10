import { useI18n } from "@/hooks/useI18n";
import { Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet } from "react-native";

interface PendingRecurringPromptProps {
  visible: boolean;
  pendingCount: number;
  onReview: () => void;
  onLater: () => void;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
  },
});

export default function PendingRecurringPrompt({
  visible,
  pendingCount,
  onReview,
  onLater,
}: PendingRecurringPromptProps) {
  const { t } = useI18n();
  const movementLabel =
    pendingCount === 1
      ? t("pendingExpenseLabelOne")
      : t("pendingExpenseLabelMany");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
    >
      <Pressable style={styles.container} onPress={onLater}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View className="rounded-[28px] border border-slate-200 bg-white p-6">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <Ionicons name="time-outline" size={28} color="#d97706" />
            </View>
            <Text className="mb-2 text-2xl font-bold text-slate-900">
              {t("pendingReviewTitle")}
            </Text>
            <Text className="mb-6 text-[15px] leading-6 text-slate-600">
              {t("pendingReviewBody", {
                count: pendingCount,
                label: movementLabel,
              })}
            </Text>

            <TouchableOpacity
              onPress={onReview}
              className="mb-3 items-center rounded-2xl bg-primary py-3.5"
              activeOpacity={0.85}
            >
              <Text className="text-base font-bold text-white">
                {t("reviewNow")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onLater}
              className="items-center rounded-2xl border border-slate-200 bg-slate-50 py-3.5"
              activeOpacity={0.85}
            >
              <Text className="text-base font-semibold text-slate-600">
                {t("later")}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
