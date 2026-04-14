import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/db/provider-factory";
import { createConnectionSession, getConnectionInputFromSession } from "@/lib/session/connection-session";
import { decryptString, encryptString } from "@/lib/security/encryption";
import type { ConnectionInput, DatabaseEngine } from "@/lib/types/db";
import {
  fallbackDeleteConnection,
  fallbackFindConnection,
  fallbackListConnections,
  fallbackSaveConnection,
  fallbackUpdateConnection,
} from "@/lib/services/fallback-store";

function normalizeEngine(engine: string): DatabaseEngine {
  if (engine === "mysql" || engine === "mariadb" || engine === "postgresql" || engine === "sqlite") {
    return engine;
  }
  return "mysql";
}

export async function testConnection(input: ConnectionInput) {
  const provider = getProvider(input);
  return provider.testConnection(input);
}

export async function connectAndCreateSession(input: ConnectionInput, label?: string) {
  const provider = getProvider(input);
  await provider.connect(input);
  return createConnectionSession(input, label);
}

export async function saveConnection(input: ConnectionInput & { name: string; tags?: string[] }) {
  const encryptedPassword = input.password ? encryptString(input.password) : null;
  try {
    return await prisma.savedConnection.create({
      data: {
        name: input.name,
        engine: input.engine,
        host: input.host,
        port: input.port,
        username: input.username,
        encryptedPassword,
        databaseName: input.databaseName,
        sqlitePath: input.sqlitePath,
        readOnly: Boolean(input.readOnly),
        tags: input.tags ? JSON.stringify(input.tags) : null,
      },
    });
  } catch {
    return fallbackSaveConnection({
      name: input.name,
      engine: input.engine,
      host: input.host,
      port: input.port,
      username: input.username,
      encryptedPassword,
      databaseName: input.databaseName,
      sqlitePath: input.sqlitePath,
      readOnly: Boolean(input.readOnly),
      tags: input.tags ?? [],
    });
  }
}

export async function listSavedConnections() {
  let rows: Array<{
    id: string;
    name: string;
    engine: string;
    host: string | null;
    port: number | null;
    username: string | null;
    encryptedPassword: string | null;
    databaseName: string | null;
    sqlitePath: string | null;
    readOnly: boolean;
    tags: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  try {
    rows = await prisma.savedConnection.findMany({
      orderBy: { updatedAt: "desc" },
    });
  } catch {
    rows = fallbackListConnections().map((row) => ({
      id: row.id,
      name: row.name,
      engine: row.engine,
      host: row.host ?? null,
      port: row.port ?? null,
      username: row.username ?? null,
      encryptedPassword: row.encryptedPassword ?? null,
      databaseName: row.databaseName ?? null,
      sqlitePath: row.sqlitePath ?? null,
      readOnly: row.readOnly,
      tags: JSON.stringify(row.tags),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
  return rows.map((row) => ({
    ...row,
    engine: normalizeEngine(row.engine),
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
  }));
}

export async function updateSavedConnection(
  id: string,
  input: Partial<ConnectionInput & { name: string; tags?: string[] }>,
) {
  try {
    return await prisma.savedConnection.update({
      where: { id },
      data: {
        name: input.name,
        engine: input.engine,
        host: input.host,
        port: input.port,
        username: input.username,
        encryptedPassword: input.password ? encryptString(input.password) : undefined,
        databaseName: input.databaseName,
        sqlitePath: input.sqlitePath,
        readOnly: input.readOnly,
        tags: input.tags ? JSON.stringify(input.tags) : undefined,
      },
    });
  } catch {
    return fallbackUpdateConnection(id, {
      name: input.name,
      engine: input.engine,
      host: input.host,
      port: input.port,
      username: input.username,
      encryptedPassword: input.password ? encryptString(input.password) : undefined,
      databaseName: input.databaseName,
      sqlitePath: input.sqlitePath,
      readOnly: input.readOnly,
      tags: input.tags,
    });
  }
}

export async function deleteSavedConnection(id: string) {
  try {
    return await prisma.savedConnection.delete({ where: { id } });
  } catch {
    fallbackDeleteConnection(id);
    return { id };
  }
}

export async function buildConnectionInputFromSaved(id: string): Promise<ConnectionInput> {
  let row = null as Awaited<ReturnType<typeof prisma.savedConnection.findUnique>> | ReturnType<typeof fallbackFindConnection>;
  try {
    row = await prisma.savedConnection.findUnique({ where: { id } });
  } catch {
    row = fallbackFindConnection(id);
  }
  if (!row) throw new Error("Connection not found");
  return {
    engine: normalizeEngine(row.engine),
    host: row.host ?? undefined,
    port: row.port ?? undefined,
    username: row.username ?? undefined,
    password: row.encryptedPassword ? decryptString(row.encryptedPassword) : undefined,
    databaseName: row.databaseName ?? undefined,
    sqlitePath: row.sqlitePath ?? undefined,
    readOnly: row.readOnly,
  };
}

export async function getProviderFromSession(sessionId: string) {
  const input = await getConnectionInputFromSession(sessionId);
  if (!input) throw new Error("Session not found or expired");
  return { provider: getProvider(input), input };
}
