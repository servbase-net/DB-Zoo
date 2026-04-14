import { stringify } from "csv-stringify/sync";
import type { ConnectionInput, QueryResult, ServerInfo } from "@/lib/types/db";
import type {
  CreateTableInput,
  DatabaseProvider,
  ExportInput,
  GetRowsOptions,
  ImportInput,
  RowMutationInput,
} from "@/lib/db/providers/types";

type MockTable = {
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string | null;
    isPrimaryKey?: boolean;
    isAutoIncrement?: boolean;
  }[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
  foreignKeys: {
    name: string;
    column: string;
    referenceTable: string;
    referenceColumn: string;
    onDelete?: string;
    onUpdate?: string;
  }[];
  rows: Record<string, unknown>[];
};

const mockState: Record<string, MockTable> = {
  "public.customers": {
    columns: [
      { name: "id", type: "int", nullable: false, isPrimaryKey: true, isAutoIncrement: true },
      { name: "email", type: "varchar(255)", nullable: false },
      { name: "status", type: "varchar(32)", nullable: false, defaultValue: "'active'" },
      { name: "created_at", type: "timestamp", nullable: false, defaultValue: "CURRENT_TIMESTAMP" },
    ],
    indexes: [{ name: "idx_customers_email", columns: ["email"], unique: true }],
    foreignKeys: [],
    rows: [
      { id: 1, email: "alice@example.com", status: "active", created_at: "2026-04-11 10:00:00" },
      { id: 2, email: "bob@example.com", status: "invited", created_at: "2026-04-12 12:30:00" },
      { id: 3, email: "charlie@example.com", status: "disabled", created_at: "2026-04-13 06:12:00" },
    ],
  },
  "public.orders": {
    columns: [
      { name: "id", type: "int", nullable: false, isPrimaryKey: true, isAutoIncrement: true },
      { name: "customer_id", type: "int", nullable: false },
      { name: "total", type: "decimal(10,2)", nullable: false },
      { name: "created_at", type: "timestamp", nullable: false, defaultValue: "CURRENT_TIMESTAMP" },
    ],
    indexes: [{ name: "idx_orders_customer", columns: ["customer_id"], unique: false }],
    foreignKeys: [
      {
        name: "fk_orders_customer",
        column: "customer_id",
        referenceTable: "customers",
        referenceColumn: "id",
        onDelete: "CASCADE",
      },
    ],
    rows: [
      { id: 101, customer_id: 1, total: 129.99, created_at: "2026-04-13 08:00:00" },
      { id: 102, customer_id: 2, total: 64.5, created_at: "2026-04-13 08:10:00" },
    ],
  },
};

function keyFor(schema = "public", table: string) {
  return `${schema}.${table}`;
}

function paginate(rows: Record<string, unknown>[], options: GetRowsOptions) {
  const start = (options.page - 1) * options.pageSize;
  const end = start + options.pageSize;
  return rows.slice(start, end);
}

export class MockProvider implements DatabaseProvider {
  engine = "mysql" as const;

  async connect(_input: ConnectionInput): Promise<void> {
    return;
  }

  async testConnection(_input: ConnectionInput) {
    return { ok: true, latencyMs: 12, message: "Connected (mock mode)", serverVersion: "mock-1.0.0" };
  }

  async listDatabases() {
    return [{ name: "servbase_demo" }];
  }

  async listSchemas() {
    return [{ name: "public" }];
  }

  async listObjects() {
    return Object.keys(mockState).map((compound) => {
      const [, table] = compound.split(".");
      return { name: table, kind: "table" as const, schema: "public" };
    });
  }

  async getTableStructure(_input: ConnectionInput, args: { table: string; schema?: string }) {
    return mockState[keyFor(args.schema, args.table)]?.columns ?? [];
  }

  async getTableIndexes(_input: ConnectionInput, args: { table: string; schema?: string }) {
    return mockState[keyFor(args.schema, args.table)]?.indexes ?? [];
  }

  async getTableForeignKeys(_input: ConnectionInput, args: { table: string; schema?: string }) {
    return mockState[keyFor(args.schema, args.table)]?.foreignKeys ?? [];
  }

  async getTableRows(
    _input: ConnectionInput,
    args: { table: string; schema?: string; options: GetRowsOptions },
  ) {
    const table = mockState[keyFor(args.schema, args.table)];
    if (!table) {
      return { rows: [], total: 0, page: args.options.page, pageSize: args.options.pageSize };
    }
    const filtered = args.options.filter
      ? table.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(args.options.filter!.toLowerCase()))
      : table.rows;
    const rows = paginate(filtered, args.options);
    return { rows, total: filtered.length, page: args.options.page, pageSize: args.options.pageSize };
  }

  async runQuery(_input: ConnectionInput, query: string): Promise<QueryResult> {
    const started = Date.now();
    const normalized = query.trim().toLowerCase();
    if (normalized.startsWith("select")) {
      const rows = mockState["public.customers"]?.rows ?? [];
      return {
        columns: Object.keys(rows[0] ?? {}),
        rows,
        durationMs: Date.now() - started,
      };
    }
    return { affectedRows: 1, durationMs: Date.now() - started };
  }

  async createTable(_input: ConnectionInput, args: CreateTableInput) {
    mockState[keyFor(args.schema, args.table)] = {
      columns: args.columns.map((column) => ({
        name: column.name,
        type: column.type,
        nullable: column.nullable ?? true,
        defaultValue: column.defaultValue,
        isPrimaryKey: column.primaryKey,
        isAutoIncrement: column.autoIncrement,
      })),
      indexes: [],
      foreignKeys: [],
      rows: [],
    };
  }

  async alterTable(_input: ConnectionInput, _sql: string) {
    return;
  }

  async insertRow(_input: ConnectionInput, args: RowMutationInput) {
    const table = mockState[keyFor(args.schema, args.table)];
    if (!table) return;
    table.rows.push(args.row);
  }

  async updateRow(_input: ConnectionInput, args: RowMutationInput) {
    const table = mockState[keyFor(args.schema, args.table)];
    if (!table) return;
    const key = Object.keys(args.primaryKey ?? {})[0];
    const value = args.primaryKey?.[key];
    const idx = table.rows.findIndex((row) => row[key] === value);
    if (idx >= 0) {
      table.rows[idx] = { ...table.rows[idx], ...args.row };
    }
  }

  async deleteRow(_input: ConnectionInput, args: RowMutationInput) {
    const table = mockState[keyFor(args.schema, args.table)];
    if (!table) return;
    const key = Object.keys(args.primaryKey ?? {})[0];
    const value = args.primaryKey?.[key];
    table.rows = table.rows.filter((row) => row[key] !== value);
  }

  async exportTable(_input: ConnectionInput, args: ExportInput) {
    const table = mockState[keyFor(args.schema, args.table)];
    if (!table) return "";
    if (args.format === "sql") {
      return table.rows
        .map((row) => {
          const cols = Object.keys(row).join(", ");
          const vals = Object.values(row)
            .map((value) => (typeof value === "string" ? `'${value}'` : String(value)))
            .join(", ");
          return `INSERT INTO ${args.table} (${cols}) VALUES (${vals});`;
        })
        .join("\n");
    }
    return stringify(table.rows, { header: true });
  }

  async importData(_input: ConnectionInput, args: ImportInput) {
    if (args.format === "csv") {
      return { inserted: args.payload.split("\n").filter(Boolean).length - 1, warnings: [] };
    }
    return { inserted: 0, warnings: ["SQL import parsing is stubbed in mock mode"] };
  }

  async getServerInfo(input: ConnectionInput): Promise<ServerInfo> {
    return {
      engine: input.engine,
      version: "mock-1.0.0",
      charset: "utf8mb4",
      collation: "utf8mb4_general_ci",
      uptime: "02:15:12",
      capabilities: ["query", "schema", "rows", "import_export"],
    };
  }
}
