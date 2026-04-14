import type { ConnectionInput } from "@/lib/types/db";
import type { EngineDiagramIntrospection } from "@/lib/erd/types";

type PgClientCtor = new (config?: Record<string, unknown>) => {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>>; fields: Array<{ name: string }>; rowCount: number | null }>;
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

export async function introspectPostgreSqlDiagram(
  input: ConnectionInput,
  args: { database?: string; schema?: string },
): Promise<EngineDiagramIntrospection> {
  const database = args.database ?? input.databaseName;
  const schema = args.schema ?? "public";
  const client = getClient(input, database);
  await client.connect();

  const tablesRes = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema],
  );

  const columnsRes = await client.query(
    `SELECT
       c.table_name,
       c.column_name,
       c.ordinal_position,
       c.data_type,
       c.udt_name,
       c.is_nullable,
       EXISTS (
         SELECT 1
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = c.table_schema
           AND tc.table_name = c.table_name
           AND kcu.column_name = c.column_name
       ) AS is_primary
     FROM information_schema.columns c
     WHERE c.table_schema = $1
     ORDER BY c.table_name, c.ordinal_position`,
    [schema],
  );

  const fkRes = await client.query(
    `SELECT
       tc.constraint_name,
       kcu.table_name AS source_table,
       kcu.column_name AS source_column,
       ccu.table_name AS target_table,
       ccu.column_name AS target_column,
       rc.update_rule,
       rc.delete_rule
     FROM information_schema.table_constraints tc
     INNER JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     INNER JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
     INNER JOIN information_schema.referential_constraints rc
       ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1`,
    [schema],
  );

  await client.end();

  const tableSet = new Set(tablesRes.rows.map((row) => String(row.table_name)));
  const fkColumnSet = new Set(
    fkRes.rows.map((row) => `${String(row.source_table)}::${String(row.source_column)}`.toLowerCase()),
  );

  return {
    tables: [...tableSet].map((table) => ({ database, schema, table })),
    columns: columnsRes.rows
      .filter((row) => tableSet.has(String(row.table_name)))
      .map((row) => {
        const dataType = String(row.data_type ?? "");
        const udtName = String(row.udt_name ?? "");
        const table = String(row.table_name);
        const column = String(row.column_name);
        return {
          database,
          schema,
          table,
          name: column,
          ordinal: Number(row.ordinal_position ?? 0),
          type: dataType === "USER-DEFINED" ? udtName : dataType,
          nullable: String(row.is_nullable) === "YES",
          isPrimaryKey: Boolean(row.is_primary),
          isForeignKey: fkColumnSet.has(`${table}::${column}`.toLowerCase()),
        };
      }),
    foreignKeys: fkRes.rows.map((row) => ({
      name: String(row.constraint_name),
      sourceDatabase: database,
      sourceSchema: schema,
      sourceTable: String(row.source_table),
      sourceColumn: String(row.source_column),
      targetDatabase: database,
      targetSchema: schema,
      targetTable: String(row.target_table),
      targetColumn: String(row.target_column),
      onDelete: String(row.delete_rule ?? ""),
      onUpdate: String(row.update_rule ?? ""),
    })),
  };
}
