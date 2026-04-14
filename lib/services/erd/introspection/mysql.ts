import type { ConnectionInput } from "@/lib/types/db";
import type { EngineDiagramIntrospection } from "@/lib/erd/types";

type MysqlConnection = {
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

function buildConfig(input: ConnectionInput, database?: string) {
  return {
    host: input.host,
    port: input.port ?? 3306,
    user: input.username,
    password: input.password,
    database: database ?? input.databaseName,
    connectTimeout: 5000,
  };
}

export async function introspectMySqlDiagram(
  input: ConnectionInput,
  args: { database?: string; schema?: string },
): Promise<EngineDiagramIntrospection> {
  const mysql = getMysqlModule();
  const database = args.database ?? input.databaseName;
  if (!database) throw new Error("A database must be selected for MySQL relational diagram");

  const connection = await mysql.createConnection(buildConfig(input, database));

  const [tablesRows] = await connection.query(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [database],
  );

  const [columnsRows] = await connection.query(
    `SELECT
       TABLE_NAME,
       COLUMN_NAME,
       ORDINAL_POSITION,
       COLUMN_TYPE,
       IS_NULLABLE,
       COLUMN_KEY
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [database],
  );

  const [fkRows] = await connection.query(
    `SELECT
       kcu.CONSTRAINT_NAME AS constraint_name,
       kcu.TABLE_NAME AS source_table,
       kcu.COLUMN_NAME AS source_column,
       kcu.REFERENCED_TABLE_NAME AS target_table,
       kcu.REFERENCED_COLUMN_NAME AS target_column,
       rc.UPDATE_RULE AS on_update,
       rc.DELETE_RULE AS on_delete
     FROM information_schema.KEY_COLUMN_USAGE kcu
     INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     WHERE kcu.TABLE_SCHEMA = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY kcu.TABLE_NAME, kcu.ORDINAL_POSITION`,
    [database],
  );

  await connection.end();

  const tableSet = new Set(
    (tablesRows as Array<Record<string, string>>).map((row) => String(row.TABLE_NAME ?? row.table_name)),
  );
  const fkColumnSet = new Set(
    (fkRows as Array<Record<string, string>>).map(
      (row) => `${String(row.source_table ?? row.TABLE_NAME)}::${String(row.source_column ?? row.COLUMN_NAME)}`.toLowerCase(),
    ),
  );

  return {
    tables: [...tableSet].map((table) => ({ database, schema: args.schema, table })),
    columns: (columnsRows as Array<Record<string, string | number>>)
      .filter((row) => tableSet.has(String(row.TABLE_NAME ?? row.table_name)))
      .map((row) => {
        const key = String(row.COLUMN_KEY ?? row.column_key ?? "");
        return {
          database,
          schema: args.schema,
          table: String(row.TABLE_NAME ?? row.table_name),
          name: String(row.COLUMN_NAME ?? row.column_name),
          ordinal: Number(row.ORDINAL_POSITION ?? row.ordinal_position ?? 0),
          type: String(row.COLUMN_TYPE ?? row.column_type),
          nullable: String(row.IS_NULLABLE ?? row.is_nullable) === "YES",
          isPrimaryKey: key === "PRI",
          isForeignKey: fkColumnSet.has(
            `${String(row.TABLE_NAME ?? row.table_name)}::${String(row.COLUMN_NAME ?? row.column_name)}`.toLowerCase(),
          ),
        };
      }),
    foreignKeys: (fkRows as Array<Record<string, string>>).map((row) => ({
      name: String(row.constraint_name ?? row.CONSTRAINT_NAME),
      sourceDatabase: database,
      sourceSchema: args.schema,
      sourceTable: String(row.source_table ?? row.TABLE_NAME),
      sourceColumn: String(row.source_column ?? row.COLUMN_NAME),
      targetDatabase: database,
      targetSchema: args.schema,
      targetTable: String(row.target_table ?? row.REFERENCED_TABLE_NAME),
      targetColumn: String(row.target_column ?? row.REFERENCED_COLUMN_NAME),
      onDelete: String(row.on_delete ?? row.DELETE_RULE ?? ""),
      onUpdate: String(row.on_update ?? row.UPDATE_RULE ?? ""),
    })),
  };
}
