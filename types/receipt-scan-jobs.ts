export const RECEIPT_SCAN_JOB_STATUSES = [
	"queued",
	"compressing",
	"uploading",
	"processing",
	"ready",
	"failed",
	"confirmed",
	"discarded",
] as const;

export type ReceiptScanJobStatus = (typeof RECEIPT_SCAN_JOB_STATUSES)[number];

export interface EnqueueReceiptScanJobInput {
	localImageUri: string;
}

export type ReceiptPaymentMethodHint = "cash" | "card" | "transfer" | "unknown";

export interface ParsedReceiptData {
	amount?: number | null;
	date?: string | null;
	merchant?: string | null;
	currency?: string | null;
	paymentMethod?: ReceiptPaymentMethodHint | null;
	categoryHint?: string | null;
	note?: string | null;
	confidence?: number | null;
	warnings?: string[];
}

export type ReceiptScanJobResult = ParsedReceiptData;

export type ReceiptScanApiResult =
	| { status: "queued" | "processing" }
	| { status: "completed"; data: ParsedReceiptData }
	| { status: "failed"; message?: string };
