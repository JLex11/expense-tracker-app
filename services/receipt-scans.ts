import { Q } from "@nozbe/watermelondb";
import * as BackgroundTask from "expo-background-task";
import { File, Directory, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as TaskManager from "expo-task-manager";
import { Image, Platform } from "react-native";
import { createUuid, database } from "@/database";
import type ReceiptScanJob from "@/database/models/ReceiptScanJob";
import { getToken } from "@/services/auth";
import type {
	ParsedReceiptData,
	ReceiptScanApiResult,
	ReceiptScanJobStatus,
} from "@/types/receipt-scan-jobs";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
const RECEIPT_SCAN_TASK = "receipt-scan-queue";
const RECEIPT_SCAN_DIRECTORY = "receipt-scans";
const MAX_LONG_EDGE = 2000;
const DEFAULT_COMPRESS_QUALITY = 0.75;
const FALLBACK_COMPRESS_QUALITY = 0.65;
const LARGE_FILE_THRESHOLD_BYTES = 1_800_000;
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

let inFlightQueue: Promise<void> | null = null;

type QueueContext = {
	locale?: string;
	currency?: string;
	timezone?: string;
};

type EnqueueReceiptScanInput = QueueContext & {
	imageUri: string;
};

type ReceiptDraft = {
	amount: string;
	date: Date;
	note: string;
	paymentMethod: "cash" | "card" | "transfer";
};

function getReceiptDirectory() {
	return new Directory(Paths.document, RECEIPT_SCAN_DIRECTORY);
}

function ensureReceiptDirectory() {
	const directory = getReceiptDirectory();
	directory.create({ idempotent: true, intermediates: true });
	return directory;
}

function sanitizeFileUri(uri: string) {
	return uri.startsWith("file://") || uri.startsWith("content://")
		? uri
		: `file://${uri}`;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		Image.getSize(
			uri,
			(width, height) => resolve({ width, height }),
			(error) => reject(error),
		);
	});
}

async function compressReceiptImage(sourceUri: string, jobId: string) {
	const uri = sanitizeFileUri(sourceUri);
	const { width, height } = await getImageSize(uri);
	const longEdge = Math.max(width, height);
	const ratio = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
	const resize =
		width >= height
			? { width: Math.round(width * ratio) }
			: { height: Math.round(height * ratio) };

	const primary = await manipulateAsync(
		uri,
		[{ resize }],
		{ compress: DEFAULT_COMPRESS_QUALITY, format: SaveFormat.JPEG },
	);
	let resultUri = primary.uri;
	let resultFile = new File(resultUri);

	if (resultFile.exists && resultFile.size > LARGE_FILE_THRESHOLD_BYTES) {
		const fallback = await manipulateAsync(
			uri,
			[{ resize }],
			{ compress: FALLBACK_COMPRESS_QUALITY, format: SaveFormat.JPEG },
		);
		resultUri = fallback.uri;
		resultFile = new File(resultUri);
	}

	const directory = ensureReceiptDirectory();
	const target = new File(directory, `${jobId}.jpg`);
	if (target.exists) target.delete();
	resultFile.copy(target);
	return target.uri;
}

function getRetryDelayMs(attempts: number) {
	return BACKOFF_MS[Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1)];
}

function isDueForRetry(job: ReceiptScanJob, now = Date.now()) {
	if (job.status === "failed") return false;
	if (job.status === "processing") return true;
	if (job.status === "queued" || job.status === "uploading" || job.status === "compressing") {
		return now - job.updatedAt.getTime() >= getRetryDelayMs(job.attempts);
	}
	return false;
}

function getTimezone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function requireBearerToken(token: string | null) {
	const normalized = token?.trim();
	if (!normalized) throw new Error("Receipt scan upload requires login.");
	return normalized;
}

async function uploadReceiptScan(
	job: ReceiptScanJob,
	context: Required<QueueContext>,
): Promise<string> {
	const token = requireBearerToken(await getToken());
	const file = new File(job.localImageUri);
	const form = new FormData();

	form.append("image", {
		uri: file.uri,
		name: `${job.id}.jpg`,
		type: "image/jpeg",
	} as unknown as Blob);
	form.append("clientScanId", job.id);
	form.append("locale", context.locale);
	form.append("currency", context.currency);
	form.append("timezone", context.timezone);

	const response = await fetch(`${API_URL}/receipt-scans`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: form,
	});

	if (!response.ok) {
		throw new Error(`Receipt upload failed (${response.status}).`);
	}

	const payload = (await response.json()) as { scanId?: unknown };
	if (typeof payload.scanId !== "string" || payload.scanId.length === 0) {
		throw new Error("Receipt upload response did not include scanId.");
	}

	return payload.scanId;
}

async function fetchReceiptScanResult(remoteJobId: string): Promise<ReceiptScanApiResult> {
	const token = requireBearerToken(await getToken());
	const response = await fetch(
		`${API_URL}/receipt-scans/${encodeURIComponent(remoteJobId)}`,
		{
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Receipt status failed (${response.status}).`);
	}

	return (await response.json()) as ReceiptScanApiResult;
}

function normalizeApiData(data: ParsedReceiptData): ParsedReceiptData {
	return {
		amount: typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : null,
		date: data.date || null,
		merchant: data.merchant || null,
		currency: data.currency || null,
		paymentMethod: data.paymentMethod || "unknown",
		categoryHint: data.categoryHint || null,
		note: data.note || data.merchant || null,
		confidence:
			typeof data.confidence === "number" && Number.isFinite(data.confidence)
				? data.confidence
				: null,
		warnings: Array.isArray(data.warnings) ? data.warnings : [],
	};
}

async function markJobFailure(job: ReceiptScanJob, error: unknown) {
	const message = error instanceof Error ? error.message : "Receipt scan failed.";
	await database.write(async () => {
		const current = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(job.id);
		const nextAttempts = current.attempts + 1;
		const retryStatus =
			current.status === "uploading"
				? "uploading"
				: current.remoteJobId
					? "processing"
					: "queued";
		await current.update((draft) => {
			draft.status = nextAttempts >= BACKOFF_MS.length ? "failed" : retryStatus;
			draft.errorMessage = message;
			draft.attempts = nextAttempts;
		});
	});
}

async function processJob(job: ReceiptScanJob, context: Required<QueueContext>) {
	try {
		if (job.status === "compressing" || job.status === "queued") {
			await database.write(async () => {
				const current = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(job.id);
				await current.update((draft) => {
					draft.status = "compressing";
					draft.errorMessage = null;
				});
			});

			const compressedUri = await compressReceiptImage(job.localImageUri, job.id);

			await database.write(async () => {
				const current = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(job.id);
				await current.update((draft) => {
					draft.localImageUri = compressedUri;
					draft.status = "uploading";
				});
			});
		}

		const currentJob = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(job.id);

		if (currentJob.status === "uploading" || !currentJob.remoteJobId) {
			const remoteJobId = await uploadReceiptScan(currentJob, context);
			await database.write(async () => {
				const current = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(job.id);
				await current.update((draft) => {
					draft.remoteJobId = remoteJobId;
					draft.status = "processing";
					draft.errorMessage = null;
					draft.attempts = 0;
				});
			});
			return;
		}

		if (currentJob.status === "processing" && currentJob.remoteJobId) {
			const result = await fetchReceiptScanResult(currentJob.remoteJobId);
			if (result.status === "completed") {
				await database.write(async () => {
					const current = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(job.id);
					await current.update((draft) => {
						draft.status = "ready";
						draft.resultJson = JSON.stringify(normalizeApiData(result.data));
						draft.errorMessage = null;
					});
				});
				return;
			}

			if (result.status === "failed") {
				throw new Error(result.message || "No se pudo leer la factura.");
			}
		}
	} catch (error) {
		await markJobFailure(job, error);
	}
}

export async function enqueueReceiptScan(input: EnqueueReceiptScanInput) {
	const jobId = createUuid();
	await database.write(async () => {
		await database.get<ReceiptScanJob>("receipt_scan_jobs").create((job) => {
			job._raw.id = jobId;
			job.localImageUri = sanitizeFileUri(input.imageUri);
			job.status = "queued";
			job.remoteJobId = null;
			job.resultJson = null;
			job.errorMessage = null;
			job.attempts = 0;
		});
	});

	void processReceiptQueue(input);
	return jobId;
}

export async function processReceiptQueue(context: QueueContext = {}) {
	if (Platform.OS === "web") return;
	if (inFlightQueue) return inFlightQueue;

	const active = (async () => {
		const jobs = await database
			.get<ReceiptScanJob>("receipt_scan_jobs")
			.query(
				Q.where("status", Q.oneOf(["queued", "compressing", "uploading", "processing"])),
				Q.sortBy("updated_at", Q.asc),
			)
			.fetch();
		const normalizedContext = {
			locale: context.locale || "en",
			currency: context.currency || "USD",
			timezone: context.timezone || getTimezone(),
		};

		for (const job of jobs) {
			if (isDueForRetry(job) || job.attempts === 0 || job.status === "processing") {
				await processJob(job, normalizedContext);
			}
		}
	})();

	inFlightQueue = active.finally(() => {
		inFlightQueue = null;
	});
	return inFlightQueue;
}

export async function retryReceiptScan(jobId: string, context?: QueueContext) {
	await database.write(async () => {
		const job = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(jobId);
		await job.update((draft) => {
			draft.status = job.remoteJobId ? "processing" : "queued";
			draft.errorMessage = null;
		});
	});
	void processReceiptQueue(context);
}

export async function discardReceiptScan(jobId: string) {
	await database.write(async () => {
		const job = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(jobId);
		deleteReceiptImage(job.localImageUri);
		await job.update((draft) => {
			draft.status = "discarded";
		});
	});
}

export async function markReceiptScanConfirmed(jobId: string) {
	await database.write(async () => {
		const job = await database.get<ReceiptScanJob>("receipt_scan_jobs").find(jobId);
		deleteReceiptImage(job.localImageUri);
		await job.update((draft) => {
			draft.status = "confirmed";
		});
	});
}

export function parseReceiptScanResult(job: ReceiptScanJob): ParsedReceiptData | null {
	if (!job.resultJson) return null;
	try {
		return JSON.parse(job.resultJson) as ParsedReceiptData;
	} catch {
		return null;
	}
}

export function getReceiptDraftFromResult(data: ParsedReceiptData | null): ReceiptDraft {
	const parsedDate = data?.date ? new Date(`${data.date}T12:00:00`) : new Date();
	const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
	const paymentMethod =
		data?.paymentMethod === "cash" ||
		data?.paymentMethod === "card" ||
		data?.paymentMethod === "transfer"
			? data.paymentMethod
			: "card";

	return {
		amount: typeof data?.amount === "number" && data.amount > 0 ? String(data.amount) : "",
		date,
		note: data?.note || data?.merchant || "",
		paymentMethod,
	};
}

export function deleteReceiptImage(uri: string) {
	try {
		const file = new File(uri);
		if (file.exists) file.delete();
	} catch {
		// Missing files should not block queue cleanup.
	}
}

export async function registerReceiptScanBackgroundTask() {
	if (Platform.OS === "web") return;
	try {
		await BackgroundTask.registerTaskAsync(RECEIPT_SCAN_TASK, {
			minimumInterval: 15,
		});
	} catch (error) {
		console.warn("Receipt scan background task unavailable", error);
	}
}

if (!TaskManager.isTaskDefined(RECEIPT_SCAN_TASK)) {
	TaskManager.defineTask(RECEIPT_SCAN_TASK, async () => {
		try {
			await processReceiptQueue();
			return BackgroundTask.BackgroundTaskResult.Success;
		} catch {
			return BackgroundTask.BackgroundTaskResult.Failed;
		}
	});
}

export const __receiptScanInternals = {
	compressReceiptImage,
	fetchReceiptScanResult,
	getRetryDelayMs,
	uploadReceiptScan,
};
