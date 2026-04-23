import { Q } from "@nozbe/watermelondb";
import { createUuid, database } from "@/database";
import type ReceiptScanJob from "@/database/models/ReceiptScanJob";
import type {
	EnqueueReceiptScanJobInput,
	ReceiptScanJobResult,
} from "@/types/receipt-scan-jobs";

const RECEIPT_SCAN_JOBS_TABLE = "receipt_scan_jobs";

export async function enqueueReceiptScanJob(input: EnqueueReceiptScanJobInput) {
	const localImageUri = input.localImageUri.trim();
	if (!localImageUri) {
		throw new Error("Receipt scan image URI is required.");
	}

	let createdJobId: string | null = null;

	await database.write(async () => {
		const created = await database
			.get<ReceiptScanJob>(RECEIPT_SCAN_JOBS_TABLE)
			.create((job) => {
				job._raw.id = createUuid();
				job.localImageUri = localImageUri;
				job.status = "queued";
				job.remoteJobId = null;
				job.resultJson = null;
				job.errorMessage = null;
				job.attempts = 0;
			});

		createdJobId = created.id;
	});

	return createdJobId;
}

export async function getQueuedReceiptScanJobs(limit = 10) {
	return database
		.get<ReceiptScanJob>(RECEIPT_SCAN_JOBS_TABLE)
		.query(
			Q.where("status", "queued"),
			Q.sortBy("created_at", Q.asc),
			Q.take(Math.max(1, Math.floor(limit))),
		)
		.fetch();
}

export async function markReceiptScanJobProcessing(
	jobId: string,
	remoteJobId: string,
) {
	const normalizedRemoteJobId = remoteJobId.trim();
	if (!normalizedRemoteJobId) {
		throw new Error("Remote receipt scan job id is required.");
	}

	await updateReceiptScanJob(jobId, (job) => {
		job.status = "processing";
		job.remoteJobId = normalizedRemoteJobId;
		job.errorMessage = null;
		job.attempts += 1;
	});
}

export async function markReceiptScanJobCompleted(
	jobId: string,
	result: ReceiptScanJobResult,
) {
	await updateReceiptScanJob(jobId, (job) => {
		job.status = "ready";
		job.resultJson = JSON.stringify(result);
		job.errorMessage = null;
	});
}

export async function markReceiptScanJobFailed(jobId: string, errorMessage: string) {
	const normalizedError = errorMessage.trim();

	await updateReceiptScanJob(jobId, (job) => {
		job.status = "failed";
		job.errorMessage = normalizedError || "Receipt scan failed.";
	});
}

async function updateReceiptScanJob(
	jobId: string,
	updater: (job: ReceiptScanJob) => void,
) {
	const normalizedJobId = jobId.trim();
	if (!normalizedJobId) {
		throw new Error("Receipt scan job id is required.");
	}

	await database.write(async () => {
		const job = await database
			.get<ReceiptScanJob>(RECEIPT_SCAN_JOBS_TABLE)
			.find(normalizedJobId);
		await job.update(updater);
	});
}
