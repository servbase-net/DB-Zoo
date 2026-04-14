import { normalizeDiagramModel } from "@/lib/erd/normalize";
import type { ErdSchemaModel } from "@/lib/erd/types";
import { getProviderFromSession } from "@/lib/services/connection-service";
import { introspectMySqlDiagram } from "@/lib/services/erd/introspection/mysql";
import { introspectPostgreSqlDiagram } from "@/lib/services/erd/introspection/postgresql";

export async function getRelationalDiagramData(
  sessionId: string,
  selectedDatabase?: string,
  selectedSchema?: string,
): Promise<
  ErdSchemaModel & {
    availableDatabases: { name: string }[];
    availableSchemas: { name: string }[];
    selectedDatabase?: string;
    selectedSchema?: string;
  }
> {
  const { provider, input } = await getProviderFromSession(sessionId);
  const availableDatabases = await provider.listDatabases(input);
  const resolvedDatabase = selectedDatabase ?? availableDatabases[0]?.name ?? input.databaseName;
  const availableSchemas = await provider.listSchemas(input, resolvedDatabase);
  const resolvedSchema = selectedSchema ?? availableSchemas[0]?.name;

  let raw;
  if (input.engine === "mysql" || input.engine === "mariadb") {
    raw = await introspectMySqlDiagram(input, { database: resolvedDatabase, schema: resolvedSchema });
  } else if (input.engine === "postgresql") {
    raw = await introspectPostgreSqlDiagram(input, { database: resolvedDatabase, schema: resolvedSchema });
  } else {
    throw new Error(`Relational diagram is currently supported for MySQL and PostgreSQL connections. Active engine: ${input.engine}`);
  }

  const model = normalizeDiagramModel({
    engine: input.engine,
    database: resolvedDatabase,
    schema: resolvedSchema,
    raw,
  });

  return {
    ...model,
    availableDatabases,
    availableSchemas,
    selectedDatabase: resolvedDatabase,
    selectedSchema: resolvedSchema,
  };
}
