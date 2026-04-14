import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider } from "@/lib/db/providers/types";
import { MockProvider } from "@/lib/db/providers/mock";

const mock = new MockProvider();

type SqliteDatabaseCtor = new (path: string, options?: { readonly?: boolean }) => {
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => { changes: number };
    reader: boolean;
  };
  close: () => void;
};

function getSqliteCtor(): SqliteDatabaseCtor {
  try {
    const req = eval("require") as (id: string) => SqliteDatabaseCtor;
    return req("better-sqlite3");
  } catch {
    throw new Error("SQLite driver not installed. Run: npm i better-sqlite3");
  }
}

function getDb(input: ConnectionInput) {
  if (!input.sqlitePath) throw new Error("sqlitePath is required for SQLite connections");
  const Database = getSqliteCtor();
  return new Database(input.sqlitePath, { readonly: Boolean(input.readOnly) });
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

export class SqliteProvider implements DatabaseProvider {
  engine = "sqlite" as const;

  async connect(input: ConnectionInput): Promise<void> {
    const db = getDb(input);
    db.prepare("SELECT 1").get();
    db.close();
  }

  async testConnection(input: ConnectionInput) {
    const started = Date.now();
    const db = getDb(input);
    const row = db.prepare("select sqlite_version() as version").get() as { version: string };
    db.close();
    return { ok: true, latencyMs: Date.now() - started, serverVersion: row.version };
  }

  async listDatabases() {
    return [{ name: "main" }];
  }

  async listSchemas() {
    return [{ name: "main" }];
  }

  async listObjects(input: ConnectionInput) {
    const db = getDb(input);
    const rows = db
      .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name")
      .all() as Array<{ name: string; type: string }>;
    db.close();
    return rows.map((row) => ({ name: row.name, kind: row.type === "view" ? ("view" as const) : ("table" as const) }));
  }

  async getTableStructure(input: ConnectionInput, args: { table: string }) {
    const db = getDb(input);
    const rows = db.prepare(`PRAGMA table_info('${args.table}')`).all() as Array<Record<string, unknown>>;
    db.close();
    return rows.map((row) => ({
      name: String(row.name),
      type: String(row.type),
      nullable: Number(row.notnull) === 0,
      defaultValue: row.dflt_value ? String(row.dflt_value) : null,
      isPrimaryKey: Number(row.pk) > 0,
    }));
  }

  async getTableIndexes(input: ConnectionInput, args: { table: string }) {
    const db = getDb(input);
    const rows = db.prepare(`PRAGMA index_list('${args.table}')`).all() as Array<Record<string, unknown>>;
    const indexes = rows.map((row) => ({
      name: String(row.name),
      columns: [] as string[],
      unique: Number(row.unique) === 1,
    }));
    for (const index of indexes) {
      const cols = db.prepare(`PRAGMA index_info('${index.name}')`).all() as Array<Record<string, unknown>>;
      index.columns = cols.map((col) => String(col.name));
    }
    db.close();
    return indexes;
  }

  async getTableForeignKeys(input: ConnectionInput, args: { table: string }) {
    const db = getDb(input);
    const rows = db.prepare(`PRAGMA foreign_key_list('${args.table}')`).all() as Array<Record<string, unknown>>;
    db.close();
    return rows.map((row, idx) => ({
      name: `fk_${args.table}_${idx}`,
      column: String(row.from),
      referenceTable: String(row.table),
      referenceColumn: String(row.to),
      onDelete: String(row.on_delete ?? ""),
      onUpdate: String(row.on_update ?? ""),
    }));
  }

  async getTableRows(input: ConnectionInput, args: Parameters<DatabaseProvider["getTableRows"]>[1]) {
    const db = getDb(input);
    const offset = (args.options.page - 1) * args.options.pageSize;
    const order = args.options.sortBy
      ? `ORDER BY "${args.options.sortBy}" ${args.options.sortDirection ?? "asc"}`
      : "";
    const rows = db.prepare(`SELECT * FROM "${args.table}" ${order} LIMIT ? OFFSET ?`).all(args.options.pageSize, offset);
    const total = Number((db.prepare(`SELECT COUNT(*) as total FROM "${args.table}"`).get() as { total: number }).total);
    db.close();
    return { rows: rows as Record<string, unknown>[], total, page: args.options.page, pageSize: args.options.pageSize };
  }

  async runQuery(input: ConnectionInput, query: string) {
    const db = getDb(input);
    const started = Date.now();
    const statement = db.prepare(query);
    if (statement.reader) {
      const rows = statement.all() as Record<string, unknown>[];
      db.close();
      return {
        columns: Object.keys(rows[0] ?? {}),
        rows,
        durationMs: Date.now() - started,
      };
    }
    const run = statement.run();
    db.close();
    return { affectedRows: run.changes, durationMs: Date.now() - started };
  }

  async createTable(input: ConnectionInput, args: Parameters<DatabaseProvider["createTable"]>[1]) {
    return mock.createTable(input, args);
  }

  async alterTable(input: ConnectionInput, sql: string) {
    await this.runQuery(input, sql);
  }

  async insertRow(input: ConnectionInput, args: Parameters<DatabaseProvider["insertRow"]>[1]) {
    const keys = Object.keys(args.row);
    if (keys.length === 0) throw new Error("Row data is required");
    const db = getDb(input);
    const columnsSql = keys.map(quoteIdent).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((key) => args.row[key] ?? null);
    db.prepare(`INSERT INTO ${quoteIdent(args.table)} (${columnsSql}) VALUES (${placeholders})`).run(...values);
    db.close();
  }

  async updateRow(input: ConnectionInput, args: Parameters<DatabaseProvider["updateRow"]>[1]) {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for updates");
    }
    const pkKeys = Object.keys(args.primaryKey);
    const setKeys = Object.keys(args.row).filter((key) => !pkKeys.includes(key));
    if (setKeys.length === 0) return;
    const db = getDb(input);
    const setSql = setKeys.map((key) => `${quoteIdent(key)} = ?`).join(", ");
    const whereSql = pkKeys.map((key) => `${quoteIdent(key)} = ?`).join(" AND ");
    const values = [...setKeys.map((key) => args.row[key] ?? null), ...pkKeys.map((key) => args.primaryKey?.[key] ?? null)];
    db.prepare(`UPDATE ${quoteIdent(args.table)} SET ${setSql} WHERE ${whereSql}`).run(...values);
    db.close();
  }

  async deleteRow(input: ConnectionInput, args: Parameters<DatabaseProvider["deleteRow"]>[1]) {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for deletes");
    }
    const pkKeys = Object.keys(args.primaryKey);
    const whereSql = pkKeys.map((key) => `${quoteIdent(key)} = ?`).join(" AND ");
    const values = pkKeys.map((key) => args.primaryKey?.[key] ?? null);
    const db = getDb(input);
    db.prepare(`DELETE FROM ${quoteIdent(args.table)} WHERE ${whereSql}`).run(...values);
    db.close();
  }

  async exportTable(input: ConnectionInput, args: Parameters<DatabaseProvider["exportTable"]>[1]) {
    return mock.exportTable(input, args);
  }

  async importData(input: ConnectionInput, args: Parameters<DatabaseProvider["importData"]>[1]) {
    return mock.importData(input, args);
  }

  async getServerInfo(input: ConnectionInput) {
    const test = await this.testConnection(input);
    return {
      engine: "sqlite" as const,
      version: test.serverVersion ?? "unknown",
      capabilities: ["query", "table_info", "pragma"],
    };
  }
}
