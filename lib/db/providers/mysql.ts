import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider, GetRowsOptions } from "@/lib/db/providers/types";
import { MockProvider } from "@/lib/db/providers/mock";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
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

function buildConfig(input: ConnectionInput, extra: Record<string, unknown> = {}) {
  return {
    host: input.host,
    port: input.port ?? 3306,
    user: input.username,
    password: input.password,
    database: input.databaseName?.trim() || undefined,
    connectTimeout: 5000,
    multipleStatements: true, // Enable by default for flexibility
    ...extra,
  };
}

function quoteIdent(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  // Basic string escaping (mysql2 handles parameterized queries, but we need for mysqldump fallback)
  return `'${String(value).replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

export class MySqlProvider implements DatabaseProvider {
  engine: ConnectionInput["engine"] = "mysql";

  async connect(input: ConnectionInput): Promise<void> {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: input.databaseName?.trim() || undefined,
    });
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
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });
    const [rows] = await conn.query("SHOW FULL TABLES");
    await conn.end();
    return (rows as Array<Record<string, string>>).map((row) => {
      const values = Object.values(row);
      return {
        name: String(values[0]),
        kind: values[1] === "VIEW" ? ("view" as const) : ("table" as const),
      };
    });
  }

  async getTableStructure(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });
    const [rows] = await conn.query(`SHOW COLUMNS FROM ${quoteIdent(args.table)}`);
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
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });
    const [rows] = await conn.query(`SHOW INDEX FROM ${quoteIdent(args.table)}`);
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
    const order = args.options.sortBy
      ? `ORDER BY ${quoteIdent(args.options.sortBy)} ${args.options.sortDirection ?? "asc"}`
      : "";
    const [countRows] = await conn.query(`SELECT COUNT(*) as total FROM ${quoteIdent(args.table)}`);
    const offset = (args.options.page - 1) * args.options.pageSize;
    const [rows] = await conn.query(
      `SELECT * FROM ${quoteIdent(args.table)} ${order} LIMIT ${args.options.pageSize} OFFSET ${offset}`,
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
    const conn = await mysql.createConnection(buildConfig(input, { multipleStatements: true }));
    try {
      const [results] = await conn.query(query);
      // For multi-statement queries, results may be an array of result sets
      const isMultiResult = Array.isArray(results) && results.length > 0 && Array.isArray(results[0]);
      if (isMultiResult) {
        // Return the last result set that has rows (if any) or the last result overall
        const lastResult = results[results.length - 1];
        const rows = Array.isArray(lastResult) ? lastResult : undefined;
        const columns = rows && rows.length > 0 ? Object.keys(rows[0] as object) : [];
        return {
          rows,
          columns,
          affectedRows: !Array.isArray(lastResult)
            ? Number((lastResult as { affectedRows?: number }).affectedRows ?? 0)
            : undefined,
          durationMs: Date.now() - started,
          multiStatement: true,
        };
      }
      // Single statement
      return {
        rows: Array.isArray(results) ? (results as Record<string, unknown>[]) : undefined,
        columns: Array.isArray(results) && results.length > 0 ? Object.keys(results[0] as object) : [],
        affectedRows: !Array.isArray(results) ? Number((results as { affectedRows?: number }).affectedRows ?? 0) : undefined,
        durationMs: Date.now() - started,
      };
    } finally {
      await conn.end();
    }
  }

  async createTable(
    input: ConnectionInput,
    args: Parameters<DatabaseProvider["createTable"]>[1],
  ): Promise<void> {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });

    const columnsDef: string[] = [];
    const primaryKeyCols: string[] = [];
    const uniqueKeys: string[] = [];
    const indexes: string[] = [];
    const foreignKeys: string[] = [];

    for (const col of args.columns) {
      let def = `${quoteIdent(col.name)} ${col.type}`;
      if (col.length) def += `(${col.length})`;
      if (!col.nullable) def += " NOT NULL";
      if (col.isAutoIncrement) def += " AUTO_INCREMENT";
      if (col.defaultValue !== undefined) {
        def += ` DEFAULT ${escapeValue(col.defaultValue)}`;
      }
      if (col.unique) uniqueKeys.push(`UNIQUE KEY ${quoteIdent(`uq_${col.name}`)} (${quoteIdent(col.name)})`);
      if (col.isPrimaryKey) primaryKeyCols.push(quoteIdent(col.name));
      columnsDef.push(def);
    }

    if (primaryKeyCols.length > 0) {
      columnsDef.push(`PRIMARY KEY (${primaryKeyCols.join(", ")})`);
    }

    // Indexes from args
    for (const idx of args.indexes ?? []) {
      const cols = idx.columns.map(quoteIdent).join(", ");
      if (idx.unique) {
        uniqueKeys.push(`UNIQUE KEY ${quoteIdent(idx.name)} (${cols})`);
      } else {
        indexes.push(`KEY ${quoteIdent(idx.name)} (${cols})`);
      }
    }

    // Foreign keys
    for (const fk of args.foreignKeys ?? []) {
      foreignKeys.push(
        `CONSTRAINT ${quoteIdent(fk.name)} FOREIGN KEY (${quoteIdent(fk.column)}) ` +
          `REFERENCES ${quoteIdent(fk.referenceTable)} (${quoteIdent(fk.referenceColumn)}) ` +
          `ON DELETE ${fk.onDelete ?? "RESTRICT"} ON UPDATE ${fk.onUpdate ?? "RESTRICT"}`,
      );
    }

    const allDefs = [...columnsDef, ...uniqueKeys, ...indexes, ...foreignKeys];
    const sql = `CREATE TABLE ${quoteIdent(args.table)} (\n  ${allDefs.join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

    await conn.query(sql);
    await conn.end();
  }

  async alterTable(input: ConnectionInput, sql: string) {
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection(buildConfig(input, { multipleStatements: true }));
    await conn.query(sql);
    await conn.end();
  }

  async insertRow(
    input: ConnectionInput,
    args: Parameters<DatabaseProvider["insertRow"]>[1],
  ): Promise<void> {
    const keys = Object.keys(args.row);
    if (keys.length === 0) throw new Error("Row data is required");
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });
    const columns = keys.map(quoteIdent).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((key) => args.row[key] ?? null);
    await conn.query(`INSERT INTO ${quoteIdent(args.table)} (${columns}) VALUES (${placeholders})`, values);
    await conn.end();
  }

  async updateRow(
    input: ConnectionInput,
    args: Parameters<DatabaseProvider["updateRow"]>[1],
  ): Promise<void> {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for updates");
    }
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });
    const pkKeys = Object.keys(args.primaryKey);
    const setKeys = Object.keys(args.row).filter((key) => !pkKeys.includes(key));
    if (setKeys.length === 0) {
      await conn.end();
      return;
    }
    const setSql = setKeys.map((key) => `${quoteIdent(key)} = ?`).join(", ");
    const whereSql = pkKeys.map((key) => `${quoteIdent(key)} = ?`).join(" AND ");
    const values = [
      ...setKeys.map((key) => args.row[key] ?? null),
      ...pkKeys.map((key) => args.primaryKey?.[key] ?? null),
    ];
    await conn.query(`UPDATE ${quoteIdent(args.table)} SET ${setSql} WHERE ${whereSql}`, values);
    await conn.end();
  }

  async deleteRow(
    input: ConnectionInput,
    args: Parameters<DatabaseProvider["deleteRow"]>[1],
  ): Promise<void> {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for deletes");
    }
    const mysql = getMysqlModule();
    const conn = await mysql.createConnection({
      ...buildConfig(input),
      database: args.database ?? input.databaseName,
    });
    const pkKeys = Object.keys(args.primaryKey);
    const whereSql = pkKeys.map((key) => `${quoteIdent(key)} = ?`).join(" AND ");
    const values = pkKeys.map((key) => args.primaryKey?.[key] ?? null);
    await conn.query(`DELETE FROM ${quoteIdent(args.table)} WHERE ${whereSql}`, values);
    await conn.end();
  }

  async exportTable(
    input: ConnectionInput,
    args: Parameters<DatabaseProvider["exportTable"]>[1],
  ): Promise<{ data: string; mimeType: string }> {
    const { database, table, format } = args;
    const db = database ?? input.databaseName;
    if (!db) throw new Error("Database name required for export");

    if (format === "sql") {
      // Try using mysqldump if available
      try {
        const cmd = `mysqldump -h ${input.host} -P ${input.port ?? 3306} -u ${input.username} --password=${input.password} --no-tablespaces ${db} ${table}`;
        const { stdout } = await execAsync(cmd, { timeout: 30000 });
        return { data: stdout, mimeType: "application/sql" };
      } catch {
        // Fallback to manual INSERT generation
        const rows = await this.getTableRows(input, {
          database: db,
          table,
          options: { page: 1, pageSize: 1000 },
        });
        if (rows.total === 0) {
          return { data: `-- No data in ${table}`, mimeType: "application/sql" };
        }
        const columns = Object.keys(rows.rows[0] || {});
        const inserts: string[] = [];
        inserts.push(`INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES`);
        const valueRows = rows.rows.map(
          (row) => `(${columns.map((col) => escapeValue(row[col])).join(", ")})`,
        );
        inserts.push(valueRows.join(",\n") + ";");
        return { data: inserts.join("\n"), mimeType: "application/sql" };
      }
    } else if (format === "csv") {
      const rows = await this.getTableRows(input, {
        database: db,
        table,
        options: { page: 1, pageSize: 100000 },
      });
      const columns = Object.keys(rows.rows[0] || {});
      const csvRows = [
        columns.join(","),
        ...rows.rows.map((row) => columns.map((col) => JSON.stringify(row[col])).join(",")),
      ];
      return { data: csvRows.join("\n"), mimeType: "text/csv" };
    } else {
      return mock.exportTable(input, args);
    }
  }

  async importData(
    input: ConnectionInput,
    args: Parameters<DatabaseProvider["importData"]>[1],
  ): Promise<{ rowsImported: number }> {
    const { database, table, data, format } = args;
    const db = database ?? input.databaseName;
    if (!db) throw new Error("Database name required for import");

    if (format === "sql") {
      const mysql = getMysqlModule();
      const conn = await mysql.createConnection({
        ...buildConfig(input, { multipleStatements: true }),
        database: db,
      });
      try {
        await conn.query(data);
        // Rows affected is hard to determine for arbitrary SQL; return estimate
        return { rowsImported: -1 };
      } finally {
        await conn.end();
      }
    } else if (format === "csv") {
      // Parse CSV and use batch insert
      const lines = data.split("\n").filter((line) => line.trim());
      if (lines.length < 2) return { rowsImported: 0 };
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        // Naive CSV parsing – improve if needed
        const values = line.split(",").map((v) => {
          const trimmed = v.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return JSON.parse(trimmed);
          }
          return trimmed === "" ? null : trimmed;
        });
        const row: Record<string, unknown> = {};
        headers.forEach((h, i) => (row[h] = values[i]));
        return row;
      });

      const mysql = getMysqlModule();
      const conn = await mysql.createConnection({ ...buildConfig(input), database: db });
      try {
        let imported = 0;
        // Batch inserts for performance
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const columns = Object.keys(batch[0]);
          const placeholders = batch
            .map(() => `(${columns.map(() => "?").join(", ")})`)
            .join(", ");
          const values = batch.flatMap((row) => columns.map((col) => row[col] ?? null));
          const sql = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES ${placeholders}`;
          const [result] = await conn.query(sql, values);
          imported += (result as { affectedRows: number }).affectedRows;
        }
        return { rowsImported: imported };
      } finally {
        await conn.end();
      }
    } else {
      return mock.importData(input, args);
    }
  }

  async getServerInfo(input: ConnectionInput) {
    const test = await this.testConnection(input);
    return {
      engine: this.engine,
      version: test.serverVersion ?? "unknown",
      charset: "utf8mb4",
      collation: "utf8mb4_general_ci",
      capabilities: ["query", "schema", "rows", "metadata", "import", "export"],
    };
  }
}
