import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/hooks/usePrefs";
import { receiptScanQueuedPromptGlobal } from "@/components/receipt-scan-queued-prompt";
import { enqueueReceiptScan, processReceiptQueue } from "@/services/receipt-scans";
import { scanReceiptDocument } from "@/services/receipt-scanner";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

export function useReceiptScannerFlow(options?: { onQueued?: () => void }) {
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
			setTimeout(() => {
				receiptScanQueuedPromptGlobal.open?.({
					onScanAnother: () => void startReceiptScan(),
				});
			}, onQueued ? 220 : 0);
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
	}, [locale, onQueued, prefs.currency, t]);

	return { isScanningReceipt, startReceiptScan };
}
