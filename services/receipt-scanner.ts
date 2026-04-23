import DocumentScanner, {
	ResponseType,
	ScanDocumentResponseStatus,
} from "react-native-document-scanner-plugin";

export async function scanReceiptDocument() {
	const result = await DocumentScanner.scanDocument({
		maxNumDocuments: 1,
		responseType: ResponseType.ImageFilePath,
		croppedImageQuality: 95,
	});

	if (result.status === ScanDocumentResponseStatus.Cancel) {
		return null;
	}

	return result.scannedImages?.[0] ?? null;
}
