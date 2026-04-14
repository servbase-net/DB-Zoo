import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { alterTable, createTable } from "@/lib/services/table-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.mode === "alter") {
      await alterTable(String(body.sessionId), String(body.sql));
      return ok({ altered: true });
    }
    await createTable(String(body.sessionId), {
      database: body.database,
      schema: body.schema,
      table: body.table,
      columns: body.columns,
    });
    return ok({ created: true }, 201);
  } catch (error) {
    return fail(error);
  }
}
