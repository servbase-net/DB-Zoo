import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { executeQuery, listQueryHistory } from "@/lib/services/query-service";
import { runQuerySchema } from "@/lib/validation/query";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = runQuerySchema.parse(body);
    const result = await executeQuery(parsed.sessionId, parsed.query, {
      database: parsed.database,
      schema: parsed.schema,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) throw new Error("sessionId is required");
    const history = await listQueryHistory(sessionId);
    return ok(history);
  } catch (error) {
    return fail(error);
  }
}
