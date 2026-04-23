import { Model } from "@nozbe/watermelondb";
import {
	date,
	field,
	readonly,
} from "@nozbe/watermelondb/decorators";
import type { ReceiptScanJobStatus } from "@/types/receipt-scan-jobs";

export default class ReceiptScanJob extends Model {
	static table = "receipt_scan_jobs";

	@field("local_image_uri") localImageUri!: string;
	@field("status") status!: ReceiptScanJobStatus;
	@field("remote_job_id") remoteJobId!: string | null;
	@field("result_json") resultJson!: string | null;
	@field("error_message") errorMessage!: string | null;
	@field("attempts") attempts!: number;

	@readonly @date("created_at") createdAt!: Date;
	@readonly @date("updated_at") updatedAt!: Date;
}
