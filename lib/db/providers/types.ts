import type {
  ConnectionInput,
  ConnectionStatus,
  DbDatabase,
  DbObjectRef,
  DbSchema,
  ExportResult,
  QueryResult,
  ServerInfo,
  TableColumn,
  TableForeignKey,
  TableIndex,
  TableRowsResult,
} from "@/lib/types/db";

export type GetRowsOptions = {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filter?: string;
};

export type CreateTableColumnInput = {
  name: string;
  type: string;
  length?: number;
  nullable?: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
  primaryKey?: boolean;
  isAutoIncrement?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
};

export type CreateTableIndexInput = {
  name: string;
  columns: string[];
  unique?: boolean;
};

export type CreateTableForeignKeyInput = {
  name: string;
  column: string;
  referenceSchema?: string;
  referenceTable: string;
  referenceColumn: string;
  onDelete?: string;
  onUpdate?: string;
};

export type CreateTableInput = {
  database?: string;
  schema?: string;
  table: string;
  columns: CreateTableColumnInput[];
  indexes?: CreateTableIndexInput[];
  foreignKeys?: CreateTableForeignKeyInput[];
};

export type RowMutationInput = {
  database?: string;
  schema?: string;
  table: string;
  row: Record<string, unknown>;
  primaryKey?: Record<string, unknown>;
  where?: string;
  whereParams?: unknown[];
};

export type ExportInput = {
  database?: string;
  schema?: string;
  table: string;
  format: "csv" | "sql";
};

export type ImportInput = {
  database?: string;
  schema?: string;
  table: string;
  format: "csv" | "sql";
  data: string;
};

export interface DatabaseProvider {
  engine: ConnectionInput["engine"];
  connect(input: ConnectionInput): Promise<void>;
  testConnection(input: ConnectionInput): Promise<ConnectionStatus>;
  listDatabases(input: ConnectionInput): Promise<DbDatabase[]>;
  listSchemas(input: ConnectionInput, database?: string): Promise<DbSchema[]>;
  listObjects(input: ConnectionInput, args: { database?: string; schema?: string }): Promise<DbObjectRef[]>;
  getTableStructure(
    input: ConnectionInput,
    args: { database?: string; schema?: string; table: string },
  ): Promise<TableColumn[]>;
  getTableIndexes(
    input: ConnectionInput,
    args: { database?: string; schema?: string; table: string },
  ): Promise<TableIndex[]>;
  getTableForeignKeys(
    input: ConnectionInput,
    args: { database?: string; schema?: string; table: string },
  ): Promise<TableForeignKey[]>;
  getTableRows(
    input: ConnectionInput,
    args: { database?: string; schema?: string; table: string; options: GetRowsOptions },
  ): Promise<TableRowsResult>;
  runQuery(input: ConnectionInput, query: string): Promise<QueryResult>;
  createTable(input: ConnectionInput, args: CreateTableInput): Promise<void>;
  alterTable(input: ConnectionInput, sql: string): Promise<void>;
  insertRow(input: ConnectionInput, args: RowMutationInput): Promise<void>;
  updateRow(input: ConnectionInput, args: RowMutationInput): Promise<void>;
  deleteRow(input: ConnectionInput, args: RowMutationInput): Promise<void>;
  exportTable(input: ConnectionInput, args: ExportInput): Promise<ExportResult>;
  importData(input: ConnectionInput, args: ImportInput): Promise<{ inserted: number; warnings: string[] }>;
  getServerInfo(input: ConnectionInput): Promise<ServerInfo>;
}
