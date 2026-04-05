import type { SyncDatabaseChangeSet } from "@nozbe/watermelondb/sync";
import type {
  ExpenseOrigin,
  ExpenseStatus,
  RecurrenceUnit,
} from "@/types/expenses";

type SyncTableName =
  | "categories"
  | "expenses"
  | "budgets"
  | "recurring_expense_rules";

type UnknownRecord = Record<string, unknown>;

interface RawTableChanges {
  created: UnknownRecord[];
  updated: UnknownRecord[];
  deleted: string[];
}

interface PullSyncResponse {
  changes: SyncDatabaseChangeSet;
  timestamp: number;
}

const SYNC_TABLES: SyncTableName[] = [
  "categories",
  "expenses",
  "budgets",
  "recurring_expense_rules",
];

const LOCAL_TO_API_FIELDS: Record<SyncTableName, Record<string, string>> = {
  categories: {
    id: "id",
    name: "name",
    icon: "icon",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  expenses: {
    id: "id",
    amount: "amount",
    category_id: "categoryId",
    date: "date",
    note: "note",
    payment_method: "paymentMethod",
    status: "status",
    origin: "origin",
    recurring_rule_id: "recurringRuleId",
    resolved_at: "resolvedAt",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  budgets: {
    id: "id",
    category_id: "categoryId",
    month_key: "monthKey",
    limit_amount: "limitAmount",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  recurring_expense_rules: {
    id: "id",
    amount: "amount",
    category_id: "categoryId",
    payment_method: "paymentMethod",
    note: "note",
    interval_value: "intervalValue",
    interval_unit: "intervalUnit",
    start_date: "startDate",
    next_due_at: "nextDueAt",
    is_active: "isActive",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
};

const API_TO_LOCAL_FIELDS = Object.fromEntries(
  Object.entries(LOCAL_TO_API_FIELDS).map(([tableName, fields]) => [
    tableName,
    Object.fromEntries(
      Object.entries(fields).map(([localKey, apiKey]) => [apiKey, localKey]),
    ),
  ]),
) as Record<SyncTableName, Record<string, string>>;

function isPlainObject(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeExpenseStatusFromApi(value: unknown): ExpenseStatus {
  switch (String(value ?? "").toUpperCase()) {
    case "CONFIRMED":
      return "confirmed";
    case "PENDING":
      return "pending";
    case "SKIPPED":
      return "skipped";
    default:
      return "confirmed";
  }
}

function normalizeExpenseStatusForApi(value: unknown): string {
  switch (value as ExpenseStatus) {
    case "pending":
      return "PENDING";
    case "skipped":
      return "SKIPPED";
    case "confirmed":
    default:
      return "CONFIRMED";
  }
}

function normalizeExpenseOriginFromApi(value: unknown): ExpenseOrigin {
  switch (String(value ?? "").toUpperCase()) {
    case "RECURRING":
    case "RECURRING_RULE":
      return "recurring";
    case "MANUAL":
    default:
      return "manual";
  }
}

function normalizeExpenseOriginForApi(value: unknown): string {
  return value === "recurring" ? "RECURRING_RULE" : "MANUAL";
}

function normalizeRecurrenceUnitFromApi(value: unknown): RecurrenceUnit {
  switch (String(value ?? "").toUpperCase()) {
    case "DAY":
    case "DAILY":
      return "day";
    case "WEEK":
    case "WEEKLY":
      return "week";
    case "YEAR":
    case "YEARLY":
      return "year";
    case "MONTH":
    case "MONTHLY":
    default:
      return "month";
  }
}

function normalizeRecurrenceUnitForApi(value: unknown): string {
  switch (value as RecurrenceUnit) {
    case "day":
      return "DAILY";
    case "week":
      return "WEEKLY";
    case "year":
      return "YEARLY";
    case "month":
    default:
      return "MONTHLY";
  }
}

function transformFieldFromApi(
  tableName: SyncTableName,
  apiKey: string,
  value: unknown,
): unknown {
  if (apiKey === "status" && tableName === "expenses") {
    return normalizeExpenseStatusFromApi(value);
  }

  if (apiKey === "origin" && tableName === "expenses") {
    return normalizeExpenseOriginFromApi(value);
  }

  if (apiKey === "intervalUnit" && tableName === "recurring_expense_rules") {
    return normalizeRecurrenceUnitFromApi(value);
  }

  if (apiKey === "deletedAt") {
    return undefined;
  }

  return value;
}

function transformFieldForApi(
  tableName: SyncTableName,
  localKey: string,
  value: unknown,
): unknown {
  if (localKey === "status" && tableName === "expenses") {
    return normalizeExpenseStatusForApi(value);
  }

  if (localKey === "origin" && tableName === "expenses") {
    return normalizeExpenseOriginForApi(value);
  }

  if (localKey === "interval_unit" && tableName === "recurring_expense_rules") {
    return normalizeRecurrenceUnitForApi(value);
  }

  return value;
}

function validateTableChanges(
  tableName: SyncTableName,
  value: unknown,
): RawTableChanges {
  if (!isPlainObject(value)) {
    throw new Error(`Invalid sync payload for table '${tableName}'.`);
  }

  const created = value.created;
  const updated = value.updated;
  const deleted = value.deleted;

  if (!Array.isArray(created) || !created.every(isPlainObject)) {
    throw new Error(`Invalid 'created' list for table '${tableName}'.`);
  }

  if (!Array.isArray(updated) || !updated.every(isPlainObject)) {
    throw new Error(`Invalid 'updated' list for table '${tableName}'.`);
  }

  if (!Array.isArray(deleted) || !deleted.every((item) => typeof item === "string")) {
    throw new Error(`Invalid 'deleted' list for table '${tableName}'.`);
  }

  return {
    created,
    updated,
    deleted,
  };
}

function mapApiRecordToLocal(
  tableName: SyncTableName,
  record: UnknownRecord,
): UnknownRecord {
  const mapped: UnknownRecord = {};
  const fieldMap = API_TO_LOCAL_FIELDS[tableName];

  for (const [apiKey, localKey] of Object.entries(fieldMap)) {
    if (!(apiKey in record)) {
      continue;
    }

    const value = transformFieldFromApi(tableName, apiKey, record[apiKey]);
    if (typeof value === "undefined") {
      continue;
    }

    mapped[localKey] = value;
  }

  return mapped;
}

function mapLocalRecordToApi(
  tableName: SyncTableName,
  record: UnknownRecord,
): UnknownRecord {
  const mapped: UnknownRecord = {};
  const fieldMap = LOCAL_TO_API_FIELDS[tableName];

  for (const [localKey, apiKey] of Object.entries(fieldMap)) {
    if (!(localKey in record)) {
      continue;
    }

    mapped[apiKey] = transformFieldForApi(tableName, localKey, record[localKey]);
  }

  return mapped;
}

export function normalizePullResponse(payload: unknown): PullSyncResponse {
  if (!isPlainObject(payload)) {
    throw new Error("Invalid pull response payload.");
  }

  const rawChanges = payload.changes;
  const rawTimestamp = payload.timestamp;

  if (!isPlainObject(rawChanges)) {
    throw new Error("Pull response is missing a valid 'changes' object.");
  }

  if (!isFiniteNumber(rawTimestamp)) {
    throw new Error("Pull response is missing a valid 'timestamp'.");
  }

  const normalizedChanges: Record<SyncTableName, RawTableChanges> =
    {} as Record<SyncTableName, RawTableChanges>;

  for (const tableName of SYNC_TABLES) {
    const tableChanges = validateTableChanges(
      tableName,
      rawChanges[tableName] ?? { created: [], updated: [], deleted: [] },
    );

    normalizedChanges[tableName] = {
      created: tableChanges.created.map((record) =>
        mapApiRecordToLocal(tableName, record),
      ),
      updated: tableChanges.updated.map((record) =>
        mapApiRecordToLocal(tableName, record),
      ),
      deleted: tableChanges.deleted,
    };
  }

  return {
    changes: normalizedChanges as unknown as SyncDatabaseChangeSet,
    timestamp: rawTimestamp,
  };
}

export function serializeChangesForApi(
  changes: SyncDatabaseChangeSet,
): Record<SyncTableName, RawTableChanges> {
  const normalizedChanges: Record<SyncTableName, RawTableChanges> =
    {} as Record<SyncTableName, RawTableChanges>;
  const changesByTable = changes as Record<string, RawTableChanges | undefined>;

  for (const tableName of SYNC_TABLES) {
    const source = changesByTable[tableName];
    normalizedChanges[tableName] = {
      created: (source?.created ?? []).map((record) =>
        mapLocalRecordToApi(tableName, record),
      ),
      updated: (source?.updated ?? []).map((record) =>
        mapLocalRecordToApi(tableName, record),
      ),
      deleted: [...(source?.deleted ?? [])],
    };
  }

  return normalizedChanges;
}
