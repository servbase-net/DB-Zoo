import type {
  ConnectionInput,
  ConnectionStatus,
  DbDatabase,
  DbObjectRef,
  DbSchema,
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
  nullable?: boolean;
  defaultValue?: string | null;
  primaryKey?: boolean;
  autoIncrement?: boolean;
};

export type CreateTableInput = {
  database?: string;
  schema?: string;
  table: string;
  columns: CreateTableColumnInput[];
};

export type RowMutationInput = {
  database?: string;
  schema?: string;
  table: string;
  row: Record<string, unknown>;
  primaryKey?: Record<string, unknown>;
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
  payload: string;
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
  exportTable(input: ConnectionInput, args: ExportInput): Promise<string>;
  importData(input: ConnectionInput, args: ImportInput): Promise<{ inserted: number; warnings: string[] }>;
  getServerInfo(input: ConnectionInput): Promise<ServerInfo>;
}
