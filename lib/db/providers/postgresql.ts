import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider, GetRowsOptions } from "@/lib/db/providers/types";
import { MockProvider } from "@/lib/db/providers/mock";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const mock = new MockProvider();

type PgClientCtor = new (config?: Record<string, unknown>) => {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{
    rows: any[];
    fields: Array<{ name: string }>;
    rowCount: number | null;
  }>;
};

function getPgClientCtor(): PgClientCtor {
  try {
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
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";
  let inLineComment = false;
  let inBlockComment = false;
  let i = 0;

  const isDollarQuoteStart = (s: string, pos: number): boolean => {
    if (s[pos] !== "$") return false;
    const endIdx = s.indexOf("$", pos + 1);
    if (endIdx === -1) return false;
    dollarTag = s.slice(pos, endIdx + 1);
    return true;
  };

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1] || "";

    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && !inBlockComment) {
      if (char === "-" && nextChar === "-") {
        inLineComment = true;
        current += char + nextChar;
        i += 2;
        continue;
      }
    }

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && !inLineComment) {
      if (char === "/" && nextChar === "*") {
        inBlockComment = true;
        current += char + nextChar;
        i += 2;
        continue;
      }
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && nextChar === "/") {
        current += nextChar;
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inLineComment && !inBlockComment) {
      if (!inDollarQuote) {
        if (isDollarQuoteStart(sql, i)) {
          inDollarQuote = true;
          current += dollarTag;
          i += dollarTag.length;
          continue;
        }
      } else {
        if (sql.slice(i, i + dollarTag.length) === dollarTag) {
          inDollarQuote = false;
          current += dollarTag;
          i += dollarTag.length;
          continue;
        }
      }
    }

    if (!inDoubleQuote && !inDollarQuote && !inLineComment && !inBlockComment) {
      if (char === "'" && sql[i - 1] !== "\\") inSingleQuote = !inSingleQuote;
    }

    if (!inSingleQuote && !inDollarQuote && !inLineComment && !inBlockComment) {
      if (char === '"' && sql[i - 1] !== "\\") inDoubleQuote = !inDoubleQuote;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote && !inDollarQuote && !inLineComment && !inBlockComment) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }

    current += char;
    i++;
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

export class PostgreSqlProvider implements DatabaseProvider {
  engine = "postgresql" as const;

  async connect(input: ConnectionInput): Promise<void> {
    const client = getClient(input, input.databaseName);
    await client.connect();
    await client.end();
  }

  async testConnection(input: ConnectionInput) {
    const started = Date.now();
    const client = getClient(input, input.databaseName ?? "postgres");
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
    const res = await client.query(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`);
    await client.end();
    return res.rows.map((row) => ({ name: row.datname as string }));
  }

  async listSchemas(input: ConnectionInput, database?: string) {
    const db = database ?? input.databaseName;
    const client = getClient(input, db);
    await client.connect();
    const res = await client.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      AND schema_name NOT LIKE 'pg_temp%' AND schema_name NOT LIKE 'pg_toast_temp%'
      ORDER BY CASE WHEN schema_name = 'public' THEN 0 ELSE 1 END, schema_name
    `);
    await client.end();
    return res.rows.map((row) => ({ name: row.schema_name as string }));
  }

  async listObjects(input: ConnectionInput, args: { database?: string; schema?: string }) {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    const [tablesRes, viewsRes, functionsRes] = await Promise.all([
      client.query(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`, [schema]),
      client.query(`SELECT table_name AS name FROM information_schema.views WHERE table_schema = $1 ORDER BY table_name`, [schema]),
      client.query(`SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema = $1 ORDER BY routine_name`, [schema]),
    ]);
    await client.end();
    return [
      ...tablesRes.rows.map((row) => ({ name: row.name as string, kind: "table" as const, schema })),
      ...viewsRes.rows.map((row) => ({ name: row.name as string, kind: "view" as const, schema })),
      ...functionsRes.rows.map((row) => ({ name: row.name as string, kind: "function" as const, schema })),
    ];
  }

  async getTableStructure(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();

    const [colsRes, pkRes] = await Promise.all([
      client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, 
        [schema, args.table]
      ),
      client.query(`
        SELECT kcu.column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2`, 
        [schema, args.table]
      )
    ]);

    await client.end();
    const pkSet = new Set(pkRes.rows.map(r => r.column_name));

    return colsRes.rows.map((row) => {
      let type = row.udt_name || row.data_type;
      if (row.character_maximum_length) type += `(${row.character_maximum_length})`;
      else if (row.numeric_precision) type += `(${row.numeric_precision}${row.numeric_scale ? `,${row.numeric_scale}` : ""})`;

      return {
        name: row.column_name as string,
        type: type as string,
        nullable: row.is_nullable === "YES",
        defaultValue: row.column_default as string | null,
        isPrimaryKey: pkSet.has(row.column_name),
        isAutoIncrement: typeof row.column_default === "string" && row.column_default.startsWith("nextval"),
      };
    });
  }

  async getTableIndexes(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    const res = await client.query(`
      SELECT i.relname AS index_name, ix.indisunique AS is_unique, a.attname AS column_name
      FROM pg_class t JOIN pg_namespace ns ON ns.oid = t.relnamespace JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE ns.nspname = $1 AND t.relname = $2 AND i.relname NOT LIKE '%_pkey' ORDER BY index_name, a.attnum`, 
      [schema, args.table]
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

  async getTableForeignKeys(input: ConnectionInput, args: { database?: string; schema?: string; table: string }) {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    const res = await client.query(`
      SELECT tc.constraint_name AS name, kcu.column_name AS column_name, ccu.table_schema AS foreign_schema,
      ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2`, 
      [schema, args.table]
    );
    await client.end();
    return res.rows.map((row) => ({
      name: row.name as string,
      column: row.column_name as string,
      referenceSchema: row.foreign_schema as string,
      referenceTable: row.foreign_table_name as string,
      referenceColumn: row.foreign_column_name as string,
    }));
  }

  async getTableRows(input: ConnectionInput, args: { database?: string; schema?: string; table: string; options: GetRowsOptions }) {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    const offset = (args.options.page - 1) * args.options.pageSize;
    const order = args.options.sortBy ? `ORDER BY ${quoteIdent(args.options.sortBy)} ${args.options.sortDirection ?? "asc"}` : "";
    const rowsRes = await client.query(`SELECT * FROM ${quoteIdent(schema)}.${quoteIdent(args.table)} ${order} LIMIT $1 OFFSET $2`, [args.options.pageSize, offset]);
    const countRes = await client.query(`SELECT COUNT(*)::int AS total FROM ${quoteIdent(schema)}.${quoteIdent(args.table)}`);
    await client.end();
    return { rows: rowsRes.rows, total: Number(countRes.rows[0]?.total ?? 0), page: args.options.page, pageSize: args.options.pageSize };
  }

  async runQuery(input: ConnectionInput, query: string) {
    const started = Date.now();
    const client = getClient(input, input.databaseName);
    await client.connect();
    try {
      const statements = splitSqlStatements(query);
      let lastResult: any = null;
      if (statements.length > 1) {
        await client.query("BEGIN");
        for (const stmt of statements) lastResult = await client.query(stmt);
        await client.query("COMMIT");
      } else if (statements.length === 1) {
        lastResult = await client.query(statements[0]);
      }
      return {
        columns: lastResult?.fields?.map((f: any) => f.name) || [],
        rows: lastResult?.rows || [],
        affectedRows: lastResult?.rowCount ?? 0,
        durationMs: Date.now() - started,
        multiStatement: statements.length > 1,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      await client.end();
    }
  }

  async createTable(input: ConnectionInput, args: Parameters<DatabaseProvider["createTable"]>[1]): Promise<void> {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    const columnsDef: string[] = [];
    const primaryKeyCols: string[] = [];
    const constraints: string[] = [];
    for (const col of args.columns) {
      let def = `${quoteIdent(col.name)} ${col.type}`;
      if (col.length) def += `(${col.length})`;
      if (!col.nullable) def += " NOT NULL";
      if (col.isAutoIncrement) {
        def = def.replace(/\b(serial|bigserial)\b/i, "INTEGER");
        def += " GENERATED BY DEFAULT AS IDENTITY";
      }
      if (col.defaultValue !== undefined && !col.isAutoIncrement) def += ` DEFAULT ${escapeValue(col.defaultValue)}`;
      if (col.unique && !col.isPrimaryKey) constraints.push(`CONSTRAINT ${quoteIdent(`uq_${col.name}`)} UNIQUE (${quoteIdent(col.name)})`);
      if (col.isPrimaryKey) primaryKeyCols.push(quoteIdent(col.name));
      columnsDef.push(def);
    }
    if (primaryKeyCols.length > 0) constraints.push(`PRIMARY KEY (${primaryKeyCols.join(", ")})`);
    for (const idx of args.indexes ?? []) {
      const cols = idx.columns.map(quoteIdent).join(", ");
      if (idx.unique) constraints.push(`CONSTRAINT ${quoteIdent(idx.name)} UNIQUE (${cols})`);
    }
    for (const fk of args.foreignKeys ?? []) {
      const refSchema = fk.referenceSchema ?? schema;
      constraints.push(`CONSTRAINT ${quoteIdent(fk.name)} FOREIGN KEY (${quoteIdent(fk.column)}) REFERENCES ${quoteIdent(refSchema)}.${quoteIdent(fk.referenceTable)} (${quoteIdent(fk.referenceColumn)}) ON DELETE ${fk.onDelete ?? "NO ACTION"} ON UPDATE ${fk.onUpdate ?? "NO ACTION"}`);
    }
    const createSql = `CREATE TABLE ${quoteIdent(schema)}.${quoteIdent(args.table)} (\n  ${[...columnsDef, ...constraints].join(",\n  ")}\n)`;
    await client.query(createSql);
    for (const idx of args.indexes ?? []) {
      if (!idx.unique) await client.query(`CREATE INDEX ${quoteIdent(idx.name)} ON ${quoteIdent(schema)}.${quoteIdent(args.table)} (${idx.columns.map(quoteIdent).join(", ")})`);
    }
    await client.end();
  }

  async alterTable(input: ConnectionInput, sql: string) { await this.runQuery(input, sql); }

  async insertRow(input: ConnectionInput, args: Parameters<DatabaseProvider["insertRow"]>[1]): Promise<void> {
    const keys = Object.keys(args.row);
    if (keys.length === 0) throw new Error("Row data is required");
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    const columnsSql = keys.map(quoteIdent).join(", ");
    const valuesSql = keys.map((_, idx) => `$${idx + 1}`).join(", ");
    await client.query(`INSERT INTO ${quoteIdent(schema)}.${quoteIdent(args.table)} (${columnsSql}) VALUES (${valuesSql})`, keys.map(k => args.row[k] ?? null));
    await client.end();
  }

  async updateRow(input: ConnectionInput, args: Parameters<DatabaseProvider["updateRow"]>[1]): Promise<void> {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    let whereClause: string;
    let whereValues: unknown[] = [];
    if (args.where) {
      whereClause = args.where;
      whereValues = args.whereParams ?? [];
    } else if (args.primaryKey && Object.keys(args.primaryKey).length > 0) {
      const pkKeys = Object.keys(args.primaryKey);
      whereClause = pkKeys.map((key, idx) => `${quoteIdent(key)} = $${idx + 1}`).join(" AND ");
      whereValues = pkKeys.map((key) => args.primaryKey![key] ?? null);
    } else {
      throw new Error("Update requires a primary key column.");
    }
    const pkKeys = args.primaryKey ? Object.keys(args.primaryKey) : [];
    const setKeys = Object.keys(args.row).filter(k => !pkKeys.includes(k));
    if (setKeys.length === 0) { await client.end(); return; }
    const setSql = setKeys.map((key, idx) => `${quoteIdent(key)} = $${idx + 1}`).join(", ");
    const offset = setKeys.length;
    const finalWhere = args.where ? whereClause : Object.keys(args.primaryKey!).map((key, idx) => `${quoteIdent(key)} = $${idx + offset + 1}`).join(" AND ");
    const allValues = [...setKeys.map(k => args.row[k] ?? null), ...whereValues];
    await client.query(`UPDATE ${quoteIdent(schema)}.${quoteIdent(args.table)} SET ${setSql} WHERE ${finalWhere}`, allValues);
    await client.end();
  }

  async deleteRow(input: ConnectionInput, args: Parameters<DatabaseProvider["deleteRow"]>[1]): Promise<void> {
    const db = args.database ?? input.databaseName;
    const schema = args.schema ?? "public";
    const client = getClient(input, db);
    await client.connect();
    let whereClause: string;
    let whereValues: unknown[] = [];
    if (args.where) {
      whereClause = args.where;
      whereValues = args.whereParams ?? [];
    } else if (args.primaryKey && Object.keys(args.primaryKey).length > 0) {
      const pkKeys = Object.keys(args.primaryKey);
      whereClause = pkKeys.map((key, idx) => `${quoteIdent(key)} = $${idx + 1}`).join(" AND ");
      whereValues = pkKeys.map((key) => args.primaryKey![key] ?? null);
    } else {
      throw new Error("Delete requires a primary key column.");
    }
    await client.query(`DELETE FROM ${quoteIdent(schema)}.${quoteIdent(args.table)} WHERE ${whereClause}`, whereValues);
    await client.end();
  }

  async exportTable(input: ConnectionInput, args: Parameters<DatabaseProvider["exportTable"]>[1]): Promise<{ data: string; mimeType: string }> {
    const { database, schema, table, format } = args;
    const db = database ?? input.databaseName;
    const sch = schema ?? "public";
    if (!db) throw new Error("Database name required for export");
    if (format === "sql") {
      try {
        const cmd = `PGPASSWORD="${input.password}" pg_dump -h ${input.host} -p ${input.port ?? 5432} -U ${input.username} -d ${db} -t ${quoteIdent(sch)}.${quoteIdent(table)} --no-owner --no-privileges`;
        const { stdout } = await execAsync(cmd, { timeout: 30000 });
        return { data: stdout, mimeType: "application/sql" };
      } catch {
        const rows = await this.getTableRows(input, { database: db, schema: sch, table, options: { page: 1, pageSize: 1000 } });
        if (rows.total === 0) return { data: `-- No data in ${sch}.${table}`, mimeType: "application/sql" };
        const columns = Object.keys(rows.rows[0] || {});
        const inserts = [`INSERT INTO ${quoteIdent(sch)}.${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES`, rows.rows.map(row => `(${columns.map(col => escapeValue(row[col])).join(", ")})`).join(",\n") + ";"];
        return { data: inserts.join("\n"), mimeType: "application/sql" };
      }
    } else if (format === "csv") {
      const rows = await this.getTableRows(input, { database: db, schema: sch, table, options: { page: 1, pageSize: 100000 } });
      const columns = Object.keys(rows.rows[0] || {});
      const csvRows = [columns.join(","), ...rows.rows.map(row => columns.map(col => JSON.stringify(row[col])).join(","))];
      return { data: csvRows.join("\n"), mimeType: "text/csv" };
    }
    return mock.exportTable(input, args);
  }

  async importData(input: ConnectionInput, args: Parameters<DatabaseProvider["importData"]>[1]): Promise<{ inserted: number; warnings: string[] }> {
    const { database, schema, table, data, format } = args;
    const db = database ?? input.databaseName;
    const sch = schema ?? "public";
    if (!db) throw new Error("Database name required for import");
    const client = getClient(input, db);
    await client.connect();
    try {
      if (format === "sql") {
        await client.query("BEGIN");
        for (const stmt of splitSqlStatements(data)) await client.query(stmt);
        await client.query("COMMIT");
        return { inserted: -1, warnings: [] };
      } else if (format === "csv") {
        const lines = data.split("\n").filter(l => l.trim());
        if (lines.length < 2) return { inserted: 0, warnings: [] };
        const headers = lines[0].split(",").map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim().startsWith('"') ? JSON.parse(v.trim()) : (v.trim() === "" ? null : v.trim()));
          const row: Record<string, any> = {};
          headers.forEach((h, i) => row[h] = values[i]);
          return row;
        });
        let imported = 0;
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const columns = Object.keys(batch[0]);
          const placeholders = batch.map((_, rIdx) => `(${columns.map((_, cIdx) => `$${rIdx * columns.length + cIdx + 1}`).join(", ")})`).join(", ");
          const result = await client.query(`INSERT INTO ${quoteIdent(sch)}.${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES ${placeholders}`, batch.flatMap(r => columns.map(c => r[c] ?? null)));
          imported += result.rowCount ?? 0;
        }
        return { inserted: imported, warnings: [] };
      }
    } finally { await client.end(); }
    return mock.importData(input, args);
  }

  async getServerInfo(input: ConnectionInput) {
    const test = await this.testConnection(input);
    const client = getClient(input, input.databaseName ?? "postgres");
    await client.connect();
    const enc = await client.query("SHOW server_encoding"), coll = await client.query("SHOW lc_collate");
    await client.end();
    return { engine: "postgresql" as const, version: test.serverVersion ?? "unknown", charset: enc.rows[0]?.server_encoding ?? "UTF8", collation: coll.rows[0]?.lc_collate ?? "en_US.UTF-8", capabilities: ["query", "schemas", "json", "roles", "import", "export", "transactions"] };
  }
}