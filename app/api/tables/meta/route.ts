import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getTableMeta } from "@/lib/services/table-service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const sessionId = params.get("sessionId");
    const table = params.get("table");
    if (!sessionId || !table) throw new Error("sessionId and table are required");
    const result = await getTableMeta(sessionId, {
      database: params.get("database") ?? undefined,
      schema: params.get("schema") ?? undefined,
      table,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
