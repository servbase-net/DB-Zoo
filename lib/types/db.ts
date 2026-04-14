export type DatabaseEngine = "mysql" | "mariadb" | "postgresql" | "sqlite";

export type ConnectionInput = {
  engine: DatabaseEngine;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  sqlitePath?: string;
  readOnly?: boolean;
};

export type ConnectionStatus = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  serverVersion?: string;
};

export type DbDatabase = {
  name: string;
};

export type DbSchema = {
  name: string;
};

export type DbObjectKind = "table" | "view" | "function";

export type DbObjectRef = {
  name: string;
  kind: DbObjectKind;
  schema?: string;
};

export type TableColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
  isAutoIncrement?: boolean;
};

export type TableIndex = {
  name: string;
  columns: string[];
  unique: boolean;
};

export type TableForeignKey = {
  name: string;
  column: string;
  referenceTable: string;
  referenceColumn: string;
  onDelete?: string;
  onUpdate?: string;
};

export type TableRowsResult = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

export type QueryResult = {
  columns?: string[];
  rows?: Record<string, unknown>[];
  affectedRows?: number;
  durationMs: number;
  notices?: string[];
};

export type ServerInfo = {
  engine: DatabaseEngine;
  version: string;
  uptime?: string;
  charset?: string;
  collation?: string;
  capabilities: string[];
};
