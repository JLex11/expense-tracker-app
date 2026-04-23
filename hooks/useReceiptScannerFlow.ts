import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { enqueueReceiptScan, processReceiptQueue } from "@/services/receipt-scans";
import { scanReceiptDocument } from "@/services/receipt-scanner";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

export function useReceiptScannerFlow(options?: { onQueued?: () => void }) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const prefs = usePrefs();
	const [isScanningReceipt, setIsScanningReceipt] = useState(false);
	const onQueued = options?.onQueued;

	const startReceiptScan = useCallback(async () => {
		try {
			setIsScanningReceipt(true);
			const imageUri = await scanReceiptDocument();
			if (!imageUri) return;

			await enqueueReceiptScan({
				imageUri,
				locale,
				currency: prefs.currency,
			});
			onQueued?.();
			void processReceiptQueue({ locale, currency: prefs.currency });

			Alert.alert(t("receiptScanQueuedTitle"), t("receiptScanQueuedBody"), [
				{
					text: t("scanAnotherReceipt"),
					onPress: () => void startReceiptScan(),
				},
				{
					text: t("receiptScanQueue"),
					onPress: () => router.push("/receipts" as any),
				},
				{ text: t("later"), style: "cancel" },
			]);
		} catch (error) {
			console.error(error);
			Alert.alert(
				t("error"),
				error instanceof Error && /native|module|document scanner/i.test(error.message)
					? t("receiptScanNativeUnavailable")
					: t("receiptScanGenericError"),
			);
		} finally {
			setIsScanningReceipt(false);
		}
	}, [locale, onQueued, prefs.currency, router, t]);

	return { isScanningReceipt, startReceiptScan };
}
