import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { explorerSchema } from "@/lib/validation/query";
import { getRelationalDiagramData } from "@/lib/services/relational-diagram-service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = explorerSchema.parse({
      sessionId: params.get("sessionId"),
      database: params.get("database") ?? undefined,
      schema: params.get("schema") ?? undefined,
    });

    const data = await getRelationalDiagramData(parsed.sessionId, parsed.database, parsed.schema);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
