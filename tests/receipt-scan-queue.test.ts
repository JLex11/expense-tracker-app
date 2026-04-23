import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const createdDrafts: any[] = [];
	const updatedDrafts: any[] = [];
	const queryFetch = vi.fn<() => Promise<any[]>>(async () => []);
	const collection = {
		create: vi.fn(),
		find: vi.fn(),
		query: vi.fn(() => ({ fetch: queryFetch })),
	};
	const database = {
		write: vi.fn(async (callback: () => Promise<void>) => callback()),
		get: vi.fn(() => collection),
	};

	function reset() {
		createdDrafts.length = 0;
		updatedDrafts.length = 0;
		queryFetch.mockReset();
		queryFetch.mockResolvedValue([]);
		collection.query.mockClear();
		collection.find.mockReset();
		collection.create.mockReset();
		collection.create.mockImplementation(async (callback: (draft: any) => void) => {
			const draft = { _raw: {} };
			callback(draft);
			createdDrafts.push(draft);
			return { id: (draft._raw as any).id };
		});
		database.write.mockClear();
		database.get.mockClear();
	}

	function mockExistingJob(attempts = 0) {
		const job = {
			attempts,
			update: vi.fn(async (callback: (draft: any) => void) => {
				const draft = {
					status: "queued",
					remoteJobId: null,
					resultJson: null,
					errorMessage: null,
					attempts,
				};
				callback(draft);
				updatedDrafts.push(draft);
			}),
		};
		collection.find.mockResolvedValue(job);
		return job;
	}

	return {
		collection,
		createdDrafts,
		database,
		mockExistingJob,
		queryFetch,
		reset,
		updatedDrafts,
	};
});

vi.mock("@/database", () => ({
	createUuid: () => "receipt-job-uuid",
	database: mocks.database,
}));

import {
	enqueueReceiptScanJob,
	getQueuedReceiptScanJobs,
	markReceiptScanJobCompleted,
	markReceiptScanJobFailed,
	markReceiptScanJobProcessing,
} from "@/services/receipt-scan-queue";

describe("receipt scan queue service", () => {
	beforeEach(() => {
		mocks.reset();
	});

	it("enqueues a local-only receipt scan job", async () => {
		const jobId = await enqueueReceiptScanJob({
			localImageUri: "  file:///tmp/receipt.jpg  ",
		});

		expect(jobId).toBe("receipt-job-uuid");
		expect(mocks.database.get).toHaveBeenCalledWith("receipt_scan_jobs");
		expect(mocks.createdDrafts[0]).toMatchObject({
			_raw: { id: "receipt-job-uuid" },
			localImageUri: "file:///tmp/receipt.jpg",
			status: "queued",
			remoteJobId: null,
			resultJson: null,
			errorMessage: null,
			attempts: 0,
		});
	});

	it("rejects empty local image URIs", async () => {
		await expect(
			enqueueReceiptScanJob({ localImageUri: "   " }),
		).rejects.toThrow("Receipt scan image URI is required.");
		expect(mocks.database.write).not.toHaveBeenCalled();
	});

	it("loads queued jobs without touching sync payloads", async () => {
		mocks.queryFetch.mockResolvedValue([{ id: "job-1" }]);

		const jobs = await getQueuedReceiptScanJobs(0);

		expect(jobs).toEqual([{ id: "job-1" }]);
		expect(mocks.collection.query).toHaveBeenCalledTimes(1);
	});

	it("marks a job as processing and increments attempts", async () => {
		const job = mocks.mockExistingJob(2);

		await markReceiptScanJobProcessing(" job-1 ", " remote-1 ");

		expect(mocks.collection.find).toHaveBeenCalledWith("job-1");
		expect(job.update).toHaveBeenCalledTimes(1);
		expect(mocks.updatedDrafts[0]).toMatchObject({
			status: "processing",
			remoteJobId: "remote-1",
			errorMessage: null,
			attempts: 3,
		});
	});

	it("stores completion result JSON locally", async () => {
		mocks.mockExistingJob();

		await markReceiptScanJobCompleted("job-1", {
			amount: 19.99,
			merchant: "Cafe",
		});

		expect(mocks.updatedDrafts[0]).toMatchObject({
			status: "ready",
			resultJson: JSON.stringify({ amount: 19.99, merchant: "Cafe" }),
			errorMessage: null,
		});
	});

	it("stores a normalized failure message", async () => {
		mocks.mockExistingJob();

		await markReceiptScanJobFailed("job-1", "  ");

		expect(mocks.updatedDrafts[0]).toMatchObject({
			status: "failed",
			errorMessage: "Receipt scan failed.",
		});
	});
});
