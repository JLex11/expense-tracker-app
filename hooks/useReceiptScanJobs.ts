import { database } from "@/database";
import type ReceiptScanJob from "@/database/models/ReceiptScanJob";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";

const ACTIVE_STATUSES = ["queued", "compressing", "uploading", "processing", "ready", "failed"];

export function useReceiptScanJobs() {
	const [jobs, setJobs] = useState<ReceiptScanJob[]>([]);

	useEffect(() => {
		let active = true;
		const query = database
			.get<ReceiptScanJob>("receipt_scan_jobs")
			.query(
				Q.where("status", Q.oneOf(ACTIVE_STATUSES)),
				Q.sortBy("created_at", Q.desc),
			);

		query.fetch().then((data) => {
			if (active) setJobs(data);
		});

		const subscription = query.observe().subscribe((data) => {
			if (active) setJobs(data);
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	}, []);

	return jobs;
}

export function useReadyReceiptScanCount() {
	const jobs = useReceiptScanJobs();
	return useMemo(() => jobs.filter((job) => job.status === "ready").length, [jobs]);
}
