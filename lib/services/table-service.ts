import { parse } from "csv-parse/sync";
import { getProviderFromSession } from "@/lib/services/connection-service";
import { writeAuditLog } from "@/lib/services/audit-service";

function toMySQLDateTime(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeRowDates(row: Record<string, unknown>) {
  const next = { ...row };

  for (const [key, value] of Object.entries(next)) {
    if (
      typeof value === "string" &&
      value.includes("T") &&
      /(_at|date|time)$/i.test(key)
    ) {
      next[key] = toMySQLDateTime(value);
    }
  }

  return next;
}

export async function getTableMeta(
  sessionId: string,
  args: { database?: string; schema?: string; table: string },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  const [columns, indexes, foreignKeys] = await Promise.all([
    provider.getTableStructure(input, args),
    provider.getTableIndexes(input, args),
    provider.getTableForeignKeys(input, args),
  ]);
  return { columns, indexes, foreignKeys };
}

export async function getTableRows(
  sessionId: string,
  args: {
    database?: string;
    schema?: string;
    table: string;
    options: { page: number; pageSize: number; sortBy?: string; sortDirection?: "asc" | "desc"; filter?: string };
  },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  return provider.getTableRows(input, args);
}

export async function insertRow(
  sessionId: string,
  args: { database?: string; schema?: string; table: string; row: Record<string, unknown> },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  if (input.readOnly) throw new Error("Read-only connection cannot insert rows");
  const normalizedArgs = {
    ...args,
    row: normalizeRowDates(args.row),
  };

  await provider.insertRow(input, normalizedArgs);

  await writeAuditLog({
    actorRole: "operator",
    action: "row.insert",
    resourceType: "table",
    resourceId: `${args.database ?? "default"}.${args.schema ?? "public"}.${args.table}`,
    payload: { row: args.row },
  });
}

export async function updateRow(
  sessionId: string,
  args: {
    database?: string;
    schema?: string;
    table: string;
    row: Record<string, unknown>;
    primaryKey?: Record<string, unknown>;
  },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  if (input.readOnly) throw new Error("Read-only connection cannot update rows");
  const normalizedArgs = {
    ...args,
    row: normalizeRowDates(args.row),
  };

  await provider.updateRow(input, normalizedArgs);
  await writeAuditLog({
    actorRole: "operator",
    action: "row.update",
    resourceType: "table",
    resourceId: `${args.database ?? "default"}.${args.schema ?? "public"}.${args.table}`,
    payload: { primaryKey: args.primaryKey },
  });
}

export async function deleteRow(
  sessionId: string,
  args: { database?: string; schema?: string; table: string; primaryKey: Record<string, unknown> },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  if (input.readOnly) throw new Error("Read-only connection cannot delete rows");
  await provider.deleteRow(input, { ...args, row: {}, primaryKey: args.primaryKey });
  await writeAuditLog({
    actorRole: "operator",
    action: "row.delete",
    resourceType: "table",
    resourceId: `${args.database ?? "default"}.${args.schema ?? "public"}.${args.table}`,
    payload: { primaryKey: args.primaryKey },
  });
}

export async function duplicateRow(
  sessionId: string,
  args: { database?: string; schema?: string; table: string; row: Record<string, unknown> },
) {
  return insertRow(sessionId, args);
}

export async function exportTable(
  sessionId: string,
  args: { database?: string; schema?: string; table: string; format: "csv" | "sql" },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  return provider.exportTable(input, args);
}

export async function importTableData(
  sessionId: string,
  args: { database?: string; schema?: string; table: string; format: "csv" | "sql"; payload: string },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  if (input.readOnly) throw new Error("Read-only connection cannot import");
  if (args.format === "csv") {
    const rows = parse(args.payload, { columns: true, skip_empty_lines: true });
    for (const row of rows as Record<string, unknown>[]) {
      await provider.insertRow(input, { ...args, row });
    }
    return { inserted: rows.length, warnings: [] as string[] };
  }
  return provider.importData(input, args);
}

export async function createTable(
  sessionId: string,
  args: {
    database?: string;
    schema?: string;
    table: string;
    columns: {
      name: string;
      type: string;
      nullable?: boolean;
      defaultValue?: string | null;
      primaryKey?: boolean;
      autoIncrement?: boolean;
    }[];
  },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  if (input.readOnly) throw new Error("Read-only connection cannot create tables");
  await provider.createTable(input, args);
}

export async function alterTable(sessionId: string, sql: string) {
  const { provider, input } = await getProviderFromSession(sessionId);
  if (input.readOnly) throw new Error("Read-only connection cannot alter tables");
  await provider.alterTable(input, sql);
}
