import { prisma } from "@/lib/prisma";
import { assertOwnSession } from "@/lib/session/connection-session";
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
    searchPath: input.engine === "postgresql" ? options?.schema : undefined,
  };

  if (input.readOnly && classifyQueryRisk(query) === "destructive") {
    throw new Error("Connection is read-only. Destructive queries are blocked.");
  }
  let result;
  try {
    result = await provider.runQuery(scopedInput, query);
  } catch (error) {
    await recordHistory(sessionId, input.engine, query, 0, null, error instanceof Error ? error.message : String(error));
    throw error;
  }
  await recordHistory(sessionId, input.engine, query, result.durationMs, result.affectedRows ?? null, null);
  await writeAuditLog({
    actorRole: "operator",
    action: "query.execute",
    resourceType: "session",
    resourceId: sessionId,
    payload: { query, durationMs: result.durationMs },
  });
  // Cap what is sent to the browser; the table console is not an export tool.
  const rows = result.rows;
  if (rows && rows.length > MAX_RESULT_ROWS) {
    return { ...result, rows: rows.slice(0, MAX_RESULT_ROWS), truncated: true, totalRows: rows.length };
  }
  return result;
}

const MAX_RESULT_ROWS = 1000;

async function recordHistory(
  sessionId: string,
  engine: string,
  queryText: string,
  durationMs: number,
  affectedRows: number | null,
  errorMessage: string | null,
) {
  const row = { sessionId, engine, queryText, durationMs, affectedRows, success: !errorMessage, errorMessage };
  try {
    await prisma.queryHistory.create({ data: row });
  } catch {
    fallbackAddHistory(row);
  }
}

export async function listQueryHistory(sessionId: string) {
  await assertOwnSession(sessionId);
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
