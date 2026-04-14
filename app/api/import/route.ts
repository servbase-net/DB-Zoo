import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { importExportSchema } from "@/lib/validation/query";
import { importTableData } from "@/lib/services/table-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = importExportSchema.parse(body);
    if (!parsed.payload) throw new Error("payload is required for import");
    const result = await importTableData(parsed.sessionId, {
      database: parsed.database,
      schema: parsed.schema,
      table: parsed.table,
      format: parsed.format,
      payload: parsed.payload,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
