import type { ConnectionInput } from "@/lib/types/db";
import type { DatabaseProvider } from "@/lib/db/providers/types";
import { MariaDbProvider } from "@/lib/db/providers/mariadb";
import { MockProvider } from "@/lib/db/providers/mock";
import { MySqlProvider } from "@/lib/db/providers/mysql";
import { PostgreSqlProvider } from "@/lib/db/providers/postgresql";
import { SqliteProvider } from "@/lib/db/providers/sqlite";

export function getProvider(input: ConnectionInput): DatabaseProvider {
  switch (input.engine) {
    case "mysql":
      return new MySqlProvider();
    case "mariadb":
      return new MariaDbProvider();
    case "postgresql":
      return new PostgreSqlProvider();
    case "sqlite":
      return new SqliteProvider();
    default:
      return new MockProvider();
  }
}

export function getMockFallbackProvider() {
  return new MockProvider();
}
