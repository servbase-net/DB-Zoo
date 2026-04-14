import type { DatabaseEngine } from "@/lib/types/db";

export type ErdColumn = {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
};

export type ErdTable = {
  id: string;
  database?: string;
  schema?: string;
  name: string;
  columns: ErdColumn[];
};

export type ErdRelationship = {
  id: string;
  name: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete?: string;
  onUpdate?: string;
};

export type ErdSchemaModel = {
  engine: DatabaseEngine;
  database?: string;
  schema?: string;
  tables: ErdTable[];
  relationships: ErdRelationship[];
};

export type EngineTable = {
  database?: string;
  schema?: string;
  table: string;
};

export type EngineColumn = {
  database?: string;
  schema?: string;
  table: string;
  name: string;
  ordinal: number;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
};

export type EngineForeignKey = {
  name: string;
  sourceDatabase?: string;
  sourceSchema?: string;
  sourceTable: string;
  sourceColumn: string;
  targetDatabase?: string;
  targetSchema?: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: string;
  onUpdate?: string;
};

export type EngineDiagramIntrospection = {
  tables: EngineTable[];
  columns: EngineColumn[];
  foreignKeys: EngineForeignKey[];
};
