import { z } from "zod";
import { getDefaultPort } from "@/lib/utils";

export const dbEngineEnum = z.enum(["mysql", "mariadb", "postgresql", "sqlite"]);

const connectionBaseFields = {
  engine: dbEngineEnum,
  host: z.string().min(1).optional(),
  port: z.coerce.number().int().nonnegative().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  databaseName: z.string().optional(),
  sqlitePath: z.string().optional(),
  readOnly: z.boolean().optional(),
};

export const connectionInputSchema = z
  .object(connectionBaseFields)
  .superRefine((value, ctx) => {
    if (value.engine === "sqlite") {
      if (!value.sqlitePath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SQLite path is required",
          path: ["sqlitePath"],
        });
      }
      return;
    }
    if (!value.host) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host is required",
        path: ["host"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    port: value.port ?? getDefaultPort(value.engine),
  }));

export const saveConnectionSchema = z
  .object({
    ...connectionBaseFields,
    name: z.string().min(2, "Connection name is required"),
    tags: z.array(z.string()).optional(),
    saveConnection: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.engine === "sqlite") {
      if (!value.sqlitePath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SQLite path is required",
          path: ["sqlitePath"],
        });
      }
      return;
    }
    if (!value.host) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host is required",
        path: ["host"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    port: value.port ?? getDefaultPort(value.engine),
  }));
