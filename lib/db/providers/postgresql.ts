import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider, GetRowsOptions } from "@/lib/db/providers/types";
import { MockProvider } from "@/lib/db/providers/mock";

const mock = new MockProvider();

type PgClientCtor = new (config?: Record<string, unknown>) => {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; fields: Array<{ name: string }>; rowCount: number | null }>;
};

function getPgClientCtor(): PgClientCtor {
  try {
    // Lazy driver resolution: build works even when pg is not installed yet.
    const req = eval("require") as (id: string) => { Client: PgClientCtor };
    return req("pg").Client;
  } catch {
    throw new Error("PostgreSQL driver not installed. Run: npm i pg");
  }
}

function getClient(input: ConnectionInput, database?: string) {
  const Client = getPgClientCtor();
  return new Client({
    host: input.host,
    port: input.port ?? 5432,
    user: input.username,
    password: input.password,
    database: database ?? input.databaseName,
    connectionTimeoutMillis: 5000,
  });
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

export class PostgreSqlProvider implements DatabaseProvider {
  engine = "postgresql" as const;

  async connect(input: ConnectionInput): Promise<void> {
    const client = getClient(input);
    await client.connect();
    await client.end();
  }

  async testConnection(input: ConnectionInput) {
    const started = Date.now();
    const client = getClient(input);
    await client.connect();
    const result = await client.query("SELECT version()");
    await client.end();
    return {
      ok: true,
      latencyMs: Date.now() - started,
      serverVersion: String(result.rows[0]?.version ?? ""),
    };
  }

  async listDatabases(input: ConnectionInput) {
    const client = getClient(input, "postgres");
    await client.connect();
    const res = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false");
    await client.end();
    return res.rows.map((row) => ({ name: row.datname as string }));
  }

  async listSchemas(input: ConnectionInput) {
    const client = getClient(input);
    await client.connect();
    const res = await client.query("SELECT schema_name FROM information_schema.schemata");
    await client.end();
    return res.rows.map((row) => ({ name: row.schema_name as string }));
  }

  async listObjects(input: ConnectionInput, args: { schema?: string }) {
    const client = getClient(input);
    await client.connect();
    const schema = args.schema ?? "public";
    const res = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
      [schema],
    );
    await client.end();
    return res.rows.map((row) => ({ name: row.table_name as string, kind: "table" as const, schema }));
  }

  async getTableStructure(input: ConnectionInput, args: { schema?: string; table: string }) {
    const client = getClient(input);
    await client.connect();
    const schema = args.schema ?? "public";
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, args.table],
    );
    await client.end();
    return res.rows.map((row) => ({
      name: row.column_name as string,
      type: row.data_type as string,
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default as string | null,
      isAutoIncrement: typeof row.column_default === "string" && row.column_default.includes("nextval"),
    }));
  }

  async getTableIndexes(input: ConnectionInput, args: { schema?: string; table: string }) {
    const client = getClient(input);
    await client.connect();
    const schema = args.schema ?? "public";
    const res = await client.query(
      `SELECT i.relname as index_name, ix.indisunique as is_unique, a.attname as column_name
       FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace ns
       WHERE t.oid = ix.indrelid
         AND i.oid = ix.indexrelid
         AND a.attrelid = t.oid
         AND a.attnum = ANY(ix.indkey)
         AND t.relnamespace = ns.oid
         AND ns.nspname = $1
         AND t.relname = $2`,
      [schema, args.table],
    );
    await client.end();
    const map = new Map<string, { name: string; columns: string[]; unique: boolean }>();
    for (const row of res.rows) {
      const name = row.index_name as string;
      if (!map.has(name)) map.set(name, { name, columns: [], unique: Boolean(row.is_unique) });
      map.get(name)!.columns.push(row.column_name as string);
    }
    return [...map.values()];
  }

  async getTableForeignKeys(input: ConnectionInput, args: { schema?: string; table: string }) {
    const client = getClient(input);
    await client.connect();
    const schema = args.schema ?? "public";
    const res = await client.query(
      `SELECT
        tc.constraint_name as name,
        kcu.column_name as column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1
         AND tc.table_name = $2`,
      [schema, args.table],
    );
    await client.end();
    return res.rows.map((row) => ({
      name: row.name as string,
      column: row.column_name as string,
      referenceTable: row.foreign_table_name as string,
      referenceColumn: row.foreign_column_name as string,
    }));
  }

  async getTableRows(input: ConnectionInput, args: { schema?: string; table: string; options: GetRowsOptions }) {
    const client = getClient(input);
    await client.connect();
    const schema = args.schema ?? "public";
    const offset = (args.options.page - 1) * args.options.pageSize;
    const order = args.options.sortBy ? `ORDER BY "${args.options.sortBy}" ${args.options.sortDirection ?? "asc"}` : "";
    const rowsRes = await client.query(
      `SELECT * FROM "${schema}"."${args.table}" ${order} LIMIT ${args.options.pageSize} OFFSET ${offset}`,
    );
    const countRes = await client.query(`SELECT COUNT(*)::int as total FROM "${schema}"."${args.table}"`);
    await client.end();
    return {
      rows: rowsRes.rows,
      total: Number(countRes.rows[0]?.total ?? 0),
      page: args.options.page,
      pageSize: args.options.pageSize,
    };
  }

  async runQuery(input: ConnectionInput, query: string) {
    const started = Date.now();
    const client = getClient(input);
    await client.connect();
    const res = await client.query(query);
    await client.end();
    return {
      columns: res.fields.map((field) => field.name),
      rows: res.rows as Record<string, unknown>[],
      affectedRows: res.rowCount ?? undefined,
      durationMs: Date.now() - started,
    };
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
    const schema = args.schema ?? "public";
    const client = getClient(input, args.database ?? input.databaseName);
    await client.connect();
    const columnsSql = keys.map(quoteIdent).join(", ");
    const valuesSql = keys.map((_, idx) => `$${idx + 1}`).join(", ");
    const values = keys.map((key) => args.row[key] ?? null);
    await client.query(
      `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(args.table)} (${columnsSql}) VALUES (${valuesSql})`,
      values,
    );
    await client.end();
  }

  async updateRow(input: ConnectionInput, args: Parameters<DatabaseProvider["updateRow"]>[1]) {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for updates");
    }
    const schema = args.schema ?? "public";
    const pkKeys = Object.keys(args.primaryKey);
    const setKeys = Object.keys(args.row).filter((key) => !pkKeys.includes(key));
    if (setKeys.length === 0) return;
    const client = getClient(input, args.database ?? input.databaseName);
    await client.connect();
    const setSql = setKeys.map((key, idx) => `${quoteIdent(key)} = $${idx + 1}`).join(", ");
    const whereSql = pkKeys
      .map((key, idx) => `${quoteIdent(key)} = $${setKeys.length + idx + 1}`)
      .join(" AND ");
    const values = [...setKeys.map((key) => args.row[key] ?? null), ...pkKeys.map((key) => args.primaryKey?.[key] ?? null)];
    await client.query(`UPDATE ${quoteIdent(schema)}.${quoteIdent(args.table)} SET ${setSql} WHERE ${whereSql}`, values);
    await client.end();
  }

  async deleteRow(input: ConnectionInput, args: Parameters<DatabaseProvider["deleteRow"]>[1]) {
    if (!args.primaryKey || Object.keys(args.primaryKey).length === 0) {
      throw new Error("Primary key is required for deletes");
    }
    const schema = args.schema ?? "public";
    const pkKeys = Object.keys(args.primaryKey);
    const client = getClient(input, args.database ?? input.databaseName);
    await client.connect();
    const whereSql = pkKeys.map((key, idx) => `${quoteIdent(key)} = $${idx + 1}`).join(" AND ");
    const values = pkKeys.map((key) => args.primaryKey?.[key] ?? null);
    await client.query(`DELETE FROM ${quoteIdent(schema)}.${quoteIdent(args.table)} WHERE ${whereSql}`, values);
    await client.end();
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
      engine: "postgresql" as const,
      version: test.serverVersion ?? "unknown",
      charset: "UTF8",
      collation: "en_US.UTF-8",
      capabilities: ["query", "schemas", "json", "roles"],
    };
  }
}
