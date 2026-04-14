import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { explorerSchema } from "@/lib/validation/query";
import { getExplorerData, getServerInfo } from "@/lib/services/explorer-service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = explorerSchema.parse({
      sessionId: params.get("sessionId"),
      database: params.get("database") ?? undefined,
      schema: params.get("schema") ?? undefined,
      includeObjects: params.get("includeObjects") ?? undefined,
      objectsPage: params.get("objectsPage") ?? undefined,
      objectsPageSize: params.get("objectsPageSize") ?? undefined,
      objectsSearch: params.get("objectsSearch") ?? undefined,
      objectsKind: params.get("objectsKind") ?? undefined,
    });
    const data = await getExplorerData(parsed.sessionId, parsed.database, parsed.schema, {
      includeObjects: parsed.includeObjects,
      objectsPage: parsed.objectsPage,
      objectsPageSize: parsed.objectsPageSize,
      objectsSearch: parsed.objectsSearch,
      objectsKind: parsed.objectsKind,
    });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = String(body.sessionId ?? "");
    const info = await getServerInfo(sessionId);
    return ok(info);
  } catch (error) {
    return fail(error);
  }
}
