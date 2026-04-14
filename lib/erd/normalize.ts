import type { EngineDiagramIntrospection, ErdSchemaModel } from "@/lib/erd/types";
import type { DatabaseEngine } from "@/lib/types/db";

function buildTableId(database: string | undefined, schema: string | undefined, table: string) {
  return [database ?? "-", schema ?? "-", table].join("::");
}

function buildColumnId(tableId: string, columnName: string) {
  return `${tableId}::${columnName}`;
}

export function normalizeDiagramModel(args: {
  engine: DatabaseEngine;
  database?: string;
  schema?: string;
  raw: EngineDiagramIntrospection;
}): ErdSchemaModel {
  const tableMap = new Map(
    args.raw.tables.map((table) => {
      const id = buildTableId(table.database ?? args.database, table.schema ?? args.schema, table.table);
      return [
        id,
        {
          id,
          database: table.database ?? args.database,
          schema: table.schema ?? args.schema,
          name: table.table,
          columns: [] as ErdSchemaModel["tables"][number]["columns"],
        },
      ];
    }),
  );

  const sortedColumns = [...args.raw.columns].sort((a, b) => {
    if (a.table !== b.table) return a.table.localeCompare(b.table);
    return a.ordinal - b.ordinal;
  });

  for (const column of sortedColumns) {
    const tableId = buildTableId(column.database ?? args.database, column.schema ?? args.schema, column.table);
    const table = tableMap.get(tableId);
    if (!table) continue;
    table.columns.push({
      id: buildColumnId(tableId, column.name),
      name: column.name,
      type: column.type,
      nullable: column.nullable,
      isPrimaryKey: column.isPrimaryKey,
      isForeignKey: column.isForeignKey,
    });
  }

  const relationships = args.raw.foreignKeys
    .map((fk) => {
      const sourceTableId = buildTableId(
        fk.sourceDatabase ?? args.database,
        fk.sourceSchema ?? args.schema,
        fk.sourceTable,
      );
      const targetTableId = buildTableId(
        fk.targetDatabase ?? args.database,
        fk.targetSchema ?? args.schema,
        fk.targetTable,
      );
      if (!tableMap.has(sourceTableId) || !tableMap.has(targetTableId)) return null;

      return {
        id: `${sourceTableId}::${fk.sourceColumn}=>${targetTableId}::${fk.targetColumn}::${fk.name}`,
        name: fk.name,
        sourceTableId,
        sourceColumnId: buildColumnId(sourceTableId, fk.sourceColumn),
        targetTableId,
        targetColumnId: buildColumnId(targetTableId, fk.targetColumn),
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const tables = [...tableMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    engine: args.engine,
    database: args.database,
    schema: args.schema,
    tables,
    relationships,
  };
}
