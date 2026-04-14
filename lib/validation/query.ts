import { z } from "zod";

const queryBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return value;
}, z.boolean());

export const runQuerySchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().min(1),
  database: z.string().optional(),
  schema: z.string().optional(),
});

export const explorerSchema = z.object({
  sessionId: z.string().min(1),
  database: z.string().optional(),
  schema: z.string().optional(),
  includeObjects: queryBoolean.optional().default(true),
  objectsPage: z.coerce.number().int().min(1).default(1),
  objectsPageSize: z.coerce.number().int().min(1).max(500).default(100),
  objectsSearch: z.string().optional(),
  objectsKind: z.enum(["all", "table", "view", "function"]).default("all"),
});

export const rowsSchema = z.object({
  sessionId: z.string().min(1),
  database: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  filter: z.string().optional(),
});

export const rowMutationSchema = z.object({
  sessionId: z.string().min(1),
  database: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().min(1),
  row: z.record(z.any()),
  primaryKey: z.record(z.any()).optional(),
});

export const importExportSchema = z.object({
  sessionId: z.string().min(1),
  database: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().min(1),
  format: z.enum(["csv", "sql"]),
  payload: z.string().optional(),
});
