import { useI18n } from "@/hooks/useI18n";
import { Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";

type PromptOptions = {
	onScanAnother?: (() => void) | null;
};

export const receiptScanQueuedPromptGlobal: {
	open: ((options?: PromptOptions) => void) | null;
	close: (() => void) | null;
} = {
	open: null,
	close: null,
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "flex-end",
		alignItems: "center",
		backgroundColor: "rgba(15, 23, 42, 0.4)",
		paddingHorizontal: 16,
		paddingBottom: 22,
	},
	card: {
		width: "100%",
		maxWidth: 380,
	},
});

export default function ReceiptScanQueuedPrompt() {
	const router = useRouter();
	const { t } = useI18n();
	const [visible, setVisible] = useState(false);
	const scanAnotherRef = useRef<(() => void) | null>(null);

	const close = useCallback(() => {
		setVisible(false);
	}, []);

	useEffect(() => {
		receiptScanQueuedPromptGlobal.open = (options) => {
			scanAnotherRef.current = options?.onScanAnother ?? null;
			setVisible(true);
		};
		receiptScanQueuedPromptGlobal.close = close;

		return () => {
			receiptScanQueuedPromptGlobal.open = null;
			receiptScanQueuedPromptGlobal.close = null;
		};
	}, [close]);

	const handleScanAnother = useCallback(() => {
		const callback = scanAnotherRef.current;
		close();
		if (callback) {
			setTimeout(() => {
				callback();
			}, 140);
		}
	}, [close]);

	const handleViewQueue = useCallback(() => {
		close();
		router.push("/receipts" as any);
	}, [close, router]);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={close}
		>
			<Pressable style={styles.container} onPress={close}>
				<Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
					<View className="overflow-hidden rounded-[30px] border border-slate-200 bg-white">
						<View className="border-b border-slate-100 bg-slate-50 px-6 py-5">
							<View className="mb-3 flex-row items-center justify-between">
								<View className="rounded-full bg-emerald-100 px-3 py-1">
									<Text className="text-[11px] font-bold uppercase tracking-[1px] text-emerald-700">
										{t("receiptScanQueuedBadge")}
									</Text>
								</View>
								<View className="h-10 w-10 items-center justify-center rounded-full bg-white">
									<Ionicons name="scan-outline" size={20} color="#0f172a" />
								</View>
							</View>
							<Text className="text-[24px] font-bold leading-7 text-slate-950">
								{t("receiptScanQueuedTitle")}
							</Text>
							<Text className="mt-2 text-[14px] leading-5.5 text-slate-600">
								{t("receiptScanQueuedBody")}
							</Text>
						</View>

						<View className="px-6 py-5">
							<TouchableOpacity
								className="mb-3 min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-4"
								onPress={handleScanAnother}
								activeOpacity={0.88}
							>
								<Text className="text-base font-bold text-white">
									{t("scanAnotherReceipt")}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								className="mb-2 min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4"
								onPress={handleViewQueue}
								activeOpacity={0.88}
							>
								<Text className="text-base font-semibold text-slate-700">
									{t("receiptScanQueue")}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								className="min-h-11 items-center justify-center"
								onPress={close}
								activeOpacity={0.75}
							>
								<Text className="text-sm font-semibold text-slate-500">
									{t("later")}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
