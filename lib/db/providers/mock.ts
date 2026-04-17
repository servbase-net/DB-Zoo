import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider } from "@/lib/db/providers/types";

export class MockProvider implements DatabaseProvider {
  engine: ConnectionInput["engine"] = "sqlite";

  async connect(_input: ConnectionInput): Promise<void> {}

  async testConnection() {
    return {
      ok: true,
      latencyMs: 0,
      serverVersion: "mock",
      message: "Using mock provider",
    };
  }

  async listDatabases() {
    return [{ name: "mock" }];
  }

  async listSchemas() {
    return [{ name: "public" }];
  }

  async listObjects() {
    return [];
  }

  async getTableStructure() {
    return [];
  }

  async getTableIndexes() {
    return [];
  }

  async getTableForeignKeys() {
    return [];
  }

  async getTableRows(
    _input: ConnectionInput,
    args: Parameters<DatabaseProvider["getTableRows"]>[1],
  ) {
    return {
      rows: [],
      total: 0,
      page: args.options.page,
      pageSize: args.options.pageSize,
    };
  }

  async runQuery() {
    return {
      columns: [],
      rows: [],
      affectedRows: 0,
      durationMs: 0,
      notices: ["Executed by mock provider"],
    };
  }

  async createTable(
    _input: ConnectionInput,
    _args: Parameters<DatabaseProvider["createTable"]>[1],
  ): Promise<void> {}

  async alterTable(_input: ConnectionInput, _sql: string): Promise<void> {}

  async insertRow(
    _input: ConnectionInput,
    _args: Parameters<DatabaseProvider["insertRow"]>[1],
  ): Promise<void> {}

  async updateRow(
    _input: ConnectionInput,
    _args: Parameters<DatabaseProvider["updateRow"]>[1],
  ): Promise<void> {}

  async deleteRow(
    _input: ConnectionInput,
    _args: Parameters<DatabaseProvider["deleteRow"]>[1],
  ): Promise<void> {}

  async exportTable(
    _input: ConnectionInput,
    args: Parameters<DatabaseProvider["exportTable"]>[1],
  ): ReturnType<DatabaseProvider["exportTable"]> {
    if (args.format === "csv") {
      return {
        data: "",
        mimeType: "text/csv",
      };
    }

    return {
      data: "",
      mimeType: "application/sql",
    };
  }

  async importData(
    _input: ConnectionInput,
    _args: Parameters<DatabaseProvider["importData"]>[1],
  ): ReturnType<DatabaseProvider["importData"]> {
    return {
      inserted: 0,
      warnings: [],
    };
  }

  async getServerInfo() {
    return {
      engine: "sqlite" as const,
      version: "mock",
      capabilities: ["mock"],
    };
  }
}