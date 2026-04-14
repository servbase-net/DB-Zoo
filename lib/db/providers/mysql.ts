import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider, GetRowsOptions } from "@/lib/db/providers/types";
import { MockProvider } from "@/lib/db/providers/mock";

const mock = new MockProvider();

type MysqlConnection = {
  ping: () => Promise<void>;
  end: () => Promise<void>;
  query: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;
};

type MysqlModule = {
  createConnection: (config: Record<string, unknown>) => Promise<MysqlConnection>;
};

function getMysqlModule(): MysqlModule {
  try {
    const req = eval("require") as (id: string) => MysqlModule;
    return req("mysql2/promise");
  } catch {
    throw new Error("MySQL driver not installed. Run: npm i mysql2");
  }
}

function buildConfig(input: ConnectionInput) {
  return {
    host: input.host,
    port: input.port ?? 3306,
    user: input.username,
    password: input.password,
    database: input.databaseName,
    connectTimeout: 5000,
  };
}

function quoteIdent(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

export class MySqlProvider implements DatabaseProvider {
  engine: ConnectionInput["engine"] = "mysql";

  async connect(input: ConnectionInput): Promise<void> {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection(buildConfig(input));
    await conn.ping();
    await conn.end();
  }

  async testConnection(input: ConnectionInput) {
    const mysql = getMysqlModule();
    const started = Date.now();
    const conn = await mysql.createConnection(buildConfig(input));
    const [rows] = await conn.query("SELECT VERSION() AS version");
    await conn.end();
    const version = Array.isArray(rows) ? String((rows[0] as { version?: string })?.version ?? "") : "";
    return { ok: true, latencyMs: Date.now() - started, serverVersion: version };
  }

  async listDatabases(input: ConnectionInput) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection(buildConfig(input));
    const [rows] = await conn.query("SHOW DATABASES");
    await conn.end();
    return (rows as Array<Record<string, string>>).map((row) => ({ name: row.Database }));
  }

  async listSchemas(input: ConnectionInput, database?: string) {
    return [{ name: database ?? input.databaseName ?? "default" }];
  }

  async listObjects(input: ConnectionInput, args: { database?: string; schema?: string }) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({ ...buildConfig(input), database: args.database ?? input.databaseName });
    const [rows] = await conn.query("SHOW FULL TABLES");
    await conn.end();
    return (rows as Array<Record<string, string>>).map((row) => {
      const values = Object.values(row);
      return { name: String(values[0]), kind: values[1] === "VIEW" ? ("view" as const) : ("table" as const) };
    });
  }

  async getTableStructure(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({ ...buildConfig(input), database: args.database ?? input.databaseName });
    const [rows] = await conn.query(`SHOW COLUMNS FROM \`${args.table}\``);
    await conn.end();
    return (rows as Array<Record<string, string>>).map((row) => ({
      name: row.Field,
      type: row.Type,
      nullable: row.Null === "YES",
      defaultValue: row.Default,
      isPrimaryKey: row.Key === "PRI",
      isAutoIncrement: row.Extra?.includes("auto_increment"),
    }));
  }

  async getTableIndexes(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({ ...buildConfig(input), database: args.database ?? input.databaseName });
    const [rows] = await conn.query(`SHOW INDEX FROM \`${args.table}\``);
    await conn.end();
    const map = new Map<string, { name: string; columns: string[]; unique: boolean }>();
    for (const row of rows as Array<Record<string, string | number>>) {
      const name = String(row.Key_name);
      if (!map.has(name)) {
        map.set(name, { name, columns: [], unique: Number(row.Non_unique) === 0 });
      }
      map.get(name)!.columns.push(String(row.Column_name));
    }
    return [...map.values()];
  }

  async getTableForeignKeys(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const mysql = getMysqlModule();
    const db = args.database ?? input.databaseName;
    const conn = await mysql.createConnection({ ...buildConfig(input), database: db });
    const [rows] = await conn.query(
      `SELECT
         CONSTRAINT_NAME as name,
         COLUMN_NAME as columnName,
         REFERENCED_TABLE_NAME as refTable,
         REFERENCED_COLUMN_NAME as refColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [db, args.table],
    );
    await conn.end();
    return (rows as Array<Record<string, string>>).map((row) => ({
      name: row.name,
      column: row.columnName,
      referenceTable: row.refTable,
      referenceColumn: row.refColumn,
    }));
  }

  async getTableRows(
    input: ConnectionInput,
    args: { database?: string; schema?: string; table: string; options: GetRowsOptions },
  ) {
    const mysql = getMysqlModule();
    const db = args.database ?? input.databaseName;
    const conn = await mysql.createConnection({ ...buildConfig(input), database: db });
    const order = args.options.sortBy ? `ORDER BY \`${args.options.sortBy}\` ${args.options.sortDirection ?? "asc"}` : "";
    const [countRows] = await conn.query(`SELECT COUNT(*) as total FROM \`${args.table}\``);
    const offset = (args.options.page - 1) * args.options.pageSize;
    const [rows] = await conn.query(
      `SELECT * FROM \`${args.table}\` ${order} LIMIT ${args.options.pageSize} OFFSET ${offset}`,
    );
    await conn.end();
    return {
      rows: rows as Record<string, unknown>[],
      total: Number((countRows as Array<{ total: number }>)[0]?.total ?? 0),
      page: args.options.page,
      pageSize: args.options.pageSize,
    };
  }

  async runQuery(input: ConnectionInput, query: string) {
    const mysql = getMysqlModule();
    const started = Date.now();
    const conn = await mysql.createConnection(buildConfig(input));
    const [rows] = await conn.query(query);
    await conn.end();
    return {
      rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : undefined,
      columns: Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0] as object) : [],
      affectedRows: !Array.isArray(rows) ? Number((rows as { affectedRows?: number }).affectedRows ?? 0) : undefined,
      durationMs: Date.now() - started,
    };
  }

  async createTable(input: ConnectionInput, args: Parameters<DatabaseProvider["createTable"]>[1]) {
    // TODO: build robust mysql ddl generator per type and constraints.
    return mock.createTable(input, args);
  }

  async alterTable(input: ConnectionInput, sql: string) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection(buildConfig(input));
    await conn.query(sql);
    await conn.end();
  }

  async insertRow(input: ConnectionInput, args: Parameters<DatabaseProvider["insertRow"]>[1]) {
    const keys = Object.keys(args.row);
    if (keys.length === 0) throw new Error("Row data is required");
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({ ...buildConfig(input), database: args.database ?? input.databaseName });
    const columns = keys.map(quoteIdent).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((key) => args.row[key] ?? null);
    await conn.query(`INSERT INTO ${quoteIdent(args.table)} (${columns}) VALUES (${placeholders})`, values);
    await conn.end();
  }

  async updateRow(input: ConnectionInput, args: Parameters<DatabaseProvider["updateRow"]>[1]) {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for updates");
    }
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({ ...buildConfig(input), database: args.database ?? input.databaseName });
    const pkKeys = Object.keys(args.primaryKey);
    const setKeys = Object.keys(args.row).filter((key) => !pkKeys.includes(key));
    if (setKeys.length === 0) {
      await conn.end();
      return;
    }
    const setSql = setKeys.map((key) => `${quoteIdent(key)} = ?`).join(", ");
    const whereSql = pkKeys.map((key) => `${quoteIdent(key)} = ?`).join(" AND ");
    const values = [...setKeys.map((key) => args.row[key] ?? null), ...pkKeys.map((key) => args.primaryKey?.[key] ?? null)];
    await conn.query(`UPDATE ${quoteIdent(args.table)} SET ${setSql} WHERE ${whereSql}`, values);
    await conn.end();
  }

  async deleteRow(input: ConnectionInput, args: Parameters<DatabaseProvider["deleteRow"]>[1]) {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for deletes");
    }
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({ ...buildConfig(input), database: args.database ?? input.databaseName });
    const pkKeys = Object.keys(args.primaryKey);
    const whereSql = pkKeys.map((key) => `${quoteIdent(key)} = ?`).join(" AND ");
    const values = pkKeys.map((key) => args.primaryKey?.[key] ?? null);
    await conn.query(`DELETE FROM ${quoteIdent(args.table)} WHERE ${whereSql}`, values);
    await conn.end();
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
      engine: this.engine,
      version: test.serverVersion ?? "unknown",
      charset: "utf8mb4",
      collation: "utf8mb4_general_ci",
      capabilities: ["query", "schema", "rows", "metadata"],
    };
  }
}
