import { prisma } from "@/lib/prisma";
import { getProviderFromSession } from "@/lib/services/connection-service";
import { writeAuditLog } from "@/lib/services/audit-service";
import { classifyQueryRisk } from "@/lib/db/query-safety";
import { fallbackAddHistory, fallbackListHistory } from "@/lib/services/fallback-store";

export async function executeQuery(
  sessionId: string,
  query: string,
  options?: { database?: string; schema?: string },
) {
  const { provider, input } = await getProviderFromSession(sessionId);
  const scopedInput = {
    ...input,
    databaseName: options?.database ?? input.databaseName,
  };
  let scopedQuery = query;
  if (options?.schema?.trim() && scopedInput.engine === "postgresql") {
    const safeSchema = options.schema.replace(/"/g, "\"\"");
    scopedQuery = `SET search_path TO "${safeSchema}";\n${query}`;
  }

  if (input.readOnly && classifyQueryRisk(query) === "destructive") {
    throw new Error("Connection is read-only. Destructive queries are blocked.");
  }
  const result = await provider.runQuery(scopedInput, scopedQuery);
  try {
    await prisma.queryHistory.create({
      data: {
        sessionId,
        engine: input.engine,
        queryText: query,
        durationMs: result.durationMs,
        affectedRows: result.affectedRows ?? null,
        success: true,
      },
    });
  } catch {
    fallbackAddHistory({
      sessionId,
      engine: input.engine,
      queryText: query,
      durationMs: result.durationMs,
      affectedRows: result.affectedRows ?? null,
      success: true,
      errorMessage: null,
    });
  }
  await writeAuditLog({
    actorRole: "operator",
    action: "query.execute",
    resourceType: "session",
    resourceId: sessionId,
    payload: { query, durationMs: result.durationMs },
  });
  return result;
}

export async function listQueryHistory(sessionId: string) {
  try {
    return await prisma.queryHistory.findMany({
      where: { sessionId },
      orderBy: { executedAt: "desc" },
      take: 100,
    });
  } catch {
    return fallbackListHistory(sessionId);
  }
}
