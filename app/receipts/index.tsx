import { useReceiptScanJobs } from "@/hooks/useReceiptScanJobs";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import {
	discardReceiptScan,
	parseReceiptScanResult,
	processReceiptQueue,
	retryReceiptScan,
} from "@/services/receipt-scans";
import { Text, TouchableOpacity, View } from "@/tw";
import type { ReceiptScanJobStatus } from "@/types/receipt-scan-jobs";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_ICON: Record<ReceiptScanJobStatus, keyof typeof Ionicons.glyphMap> = {
	queued: "cloud-upload-outline",
	compressing: "scan-outline",
	uploading: "cloud-upload-outline",
	processing: "hourglass-outline",
	ready: "checkmark-circle-outline",
	failed: "alert-circle-outline",
	confirmed: "checkmark-done-outline",
	discarded: "trash-outline",
};

function getStatusLabel(status: ReceiptScanJobStatus, t: (key: string) => string) {
	switch (status) {
		case "ready":
			return t("receiptScanReady");
		case "processing":
			return t("receiptScanProcessing");
		case "uploading":
			return t("receiptScanUploading");
		case "failed":
			return t("receiptScanFailed");
		case "queued":
		case "compressing":
		default:
			return t("receiptScanQueued");
	}
}

export default function ReceiptScansScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { t, locale } = useI18n();
	const prefs = usePrefs();
	const jobs = useReceiptScanJobs();

	useEffect(() => {
		void processReceiptQueue({ locale, currency: prefs.currency });
	}, [locale, prefs.currency]);

	return (
		<View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
			<View className="flex-row items-center justify-between px-5 pb-4">
				<TouchableOpacity onPress={() => router.back()} hitSlop={10}>
					<Ionicons name="chevron-back" size={24} color="#111827" />
				</TouchableOpacity>
				<View className="flex-1 px-3">
					<Text className="text-xl font-bold text-gray-950">{t("receiptScans")}</Text>
					<Text className="mt-0.5 text-[13px] text-gray-500">
						{t("receiptScansSubtitle")}
					</Text>
				</View>
				<TouchableOpacity
					className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
					onPress={() => void processReceiptQueue({ locale, currency: prefs.currency })}
				>
					<Ionicons name="refresh" size={18} color="#111827" />
				</TouchableOpacity>
			</View>

			<FlatList
				data={jobs}
				keyExtractor={(job) => job.id}
				contentContainerStyle={{
					paddingHorizontal: 20,
					paddingBottom: insets.bottom + 32,
					flexGrow: 1,
				}}
				ListEmptyComponent={
					<View className="flex-1 items-center justify-center px-8">
						<View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-gray-100">
							<Ionicons name="receipt-outline" size={26} color="#6b7280" />
						</View>
						<Text className="text-center text-lg font-bold text-gray-900">
							{t("receiptScanEmptyTitle")}
						</Text>
						<Text className="mt-2 text-center text-sm leading-5 text-gray-500">
							{t("receiptScanEmptyBody")}
						</Text>
					</View>
				}
				renderItem={({ item }) => {
					const result = parseReceiptScanResult(item);
					const title = result?.merchant || result?.note || t("receiptScanReview");
					const amount =
						typeof result?.amount === "number" && result.amount > 0
							? new Intl.NumberFormat(locale, {
									style: "currency",
									currency: prefs.currency,
								}).format(result.amount)
							: null;
					const isReady = item.status === "ready";

					return (
						<TouchableOpacity
							className="mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white p-3 shadow-sm shadow-gray-200"
							disabled={!isReady}
							onPress={() =>
								router.push({
									pathname: "/receipts/review/[id]",
									params: { id: item.id },
								} as any)
							}
						>
							<Image
								source={{ uri: item.localImageUri }}
								className="h-16 w-12 rounded-xl bg-gray-100"
								contentFit="cover"
							/>
							<View className="ml-3 flex-1">
								<View className="mb-1 flex-row items-center">
									<Ionicons
										name={STATUS_ICON[item.status]}
										size={15}
										color={item.status === "failed" ? "#ef4444" : isReady ? "#16a34a" : "#6b7280"}
									/>
									<Text className="ml-1.5 text-[12px] font-semibold text-gray-500">
										{getStatusLabel(item.status, t)}
									</Text>
								</View>
								<Text numberOfLines={1} className="text-base font-bold text-gray-950">
									{title}
								</Text>
								<Text numberOfLines={1} className="mt-0.5 text-sm text-gray-500">
									{amount || new Date(item.createdAt).toLocaleString(locale)}
								</Text>
							</View>

							{item.status === "failed" ? (
								<View className="flex-row gap-2">
									<TouchableOpacity
										className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
										onPress={() => void retryReceiptScan(item.id, { locale, currency: prefs.currency })}
									>
										<Ionicons name="refresh" size={17} color="#111827" />
									</TouchableOpacity>
									<TouchableOpacity
										className="h-9 w-9 items-center justify-center rounded-full bg-red-50"
										onPress={() =>
											Alert.alert(t("receiptScanDiscardTitle"), t("receiptScanDiscardBody"), [
												{ text: t("cancel"), style: "cancel" },
												{
													text: t("delete"),
													style: "destructive",
													onPress: () => void discardReceiptScan(item.id),
												},
											])
										}
									>
										<Ionicons name="trash-outline" size={17} color="#ef4444" />
									</TouchableOpacity>
								</View>
							) : (
								<Ionicons name="chevron-forward" size={18} color="#9ca3af" />
							)}
						</TouchableOpacity>
					);
				}}
			/>
		</View>
	);
}
