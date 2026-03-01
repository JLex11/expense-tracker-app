import { Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable } from "react-native";

interface PendingRecurringPromptProps {
	visible: boolean;
	pendingCount: number;
	onReview: () => void;
	onLater: () => void;
}

export default function PendingRecurringPrompt({
	visible,
	pendingCount,
	onReview,
	onLater,
}: PendingRecurringPromptProps) {
	const movementLabel = pendingCount === 1 ? "gasto pendiente" : "gastos pendientes";

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onLater}
		>
			<Pressable className="flex-1 items-center justify-center bg-slate-950/45 px-5">
				<View className="w-full max-w-[360px] rounded-[28px] border border-slate-200 bg-white p-6">
					<View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-amber-100">
						<Ionicons name="time-outline" size={28} color="#d97706" />
					</View>
					<Text className="mb-2 text-2xl font-bold text-slate-900">
						Revisar recurrentes
					</Text>
					<Text className="mb-6 text-[15px] leading-6 text-slate-600">
						Tienes {pendingCount} {movementLabel}. Revísalos para confirmar si
						realmente hiciste esos pagos.
					</Text>

					<TouchableOpacity
						onPress={onReview}
						className="mb-3 items-center rounded-2xl bg-primary py-3.5"
						activeOpacity={0.85}
					>
						<Text className="text-base font-bold text-white">
							Revisar ahora
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={onLater}
						className="items-center rounded-2xl border border-slate-200 bg-slate-50 py-3.5"
						activeOpacity={0.85}
					>
						<Text className="text-base font-semibold text-slate-600">
							Más tarde
						</Text>
					</TouchableOpacity>
				</View>
			</Pressable>
		</Modal>
	);
}
