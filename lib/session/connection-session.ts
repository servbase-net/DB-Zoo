import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decryptString, encryptString } from "@/lib/security/encryption";
import type { ConnectionInput, DatabaseEngine } from "@/lib/types/db";
import { ACTIVE_SESSION_COOKIE } from "@/lib/session/constants";
import { fallbackCreateSession, fallbackGetSession, fallbackListSessions } from "@/lib/services/fallback-store";

const SESSION_TTL_HOURS = 12;

function normalizeEngine(engine: string): DatabaseEngine {
  if (engine === "mysql" || engine === "mariadb" || engine === "postgresql" || engine === "sqlite") {
    return engine;
  }
  return "mysql";
}

export async function createConnectionSession(input: ConnectionInput, label?: string) {
  let sessionId: string = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  try {
    await prisma.connectionSession.create({
      data: {
        id: sessionId,
        label: label ?? `${input.engine}:${input.host ?? input.sqlitePath ?? "session"}`,
        engine: input.engine,
        host: input.host,
        port: input.port,
        username: input.username,
        encryptedPassword: input.password ? encryptString(input.password) : null,
        databaseName: input.databaseName,
        sqlitePath: input.sqlitePath,
        readOnly: Boolean(input.readOnly),
        expiresAt,
      },
    });
  } catch {
    const fallback = fallbackCreateSession({
      label: label ?? `${input.engine}:${input.host ?? input.sqlitePath ?? "session"}`,
      connection: input,
      expiresAt,
    });
    sessionId = fallback.id;
  }
  (await cookies()).set(ACTIVE_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return sessionId;
}

export async function listActiveSessions() {
  try {
    await prisma.connectionSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return prisma.connectionSession.findMany({
      orderBy: { updatedAt: "desc" },
    });
  } catch {
    return fallbackListSessions().map((session) => ({
      id: session.id,
      label: session.label,
      engine: session.input.engine,
      host: session.input.host ?? null,
      port: session.input.port ?? null,
      username: session.input.username ?? null,
      encryptedPassword: session.input.password ? encryptString(session.input.password) : null,
      databaseName: session.input.databaseName ?? null,
      sqlitePath: session.input.sqlitePath ?? null,
      readOnly: Boolean(session.input.readOnly),
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }
}

export async function getConnectionInputFromSession(sessionId?: string): Promise<ConnectionInput | null> {
  const fromCookie = (await cookies()).get(ACTIVE_SESSION_COOKIE)?.value;
  const id = sessionId ?? fromCookie;
  if (!id) return null;
  let session = null as Awaited<ReturnType<typeof prisma.connectionSession.findUnique>> | null;
  try {
    session = await prisma.connectionSession.findUnique({ where: { id } });
  } catch {
    const fallback = fallbackGetSession(id);
    if (!fallback) return null;
    return fallback.input;
  }
  if (!session || session.expiresAt < new Date()) return null;
  return {
    engine: normalizeEngine(session.engine),
    host: session.host ?? undefined,
    port: session.port ?? undefined,
    username: session.username ?? undefined,
    password: session.encryptedPassword ? decryptString(session.encryptedPassword) : undefined,
    databaseName: session.databaseName ?? undefined,
    sqlitePath: session.sqlitePath ?? undefined,
    readOnly: session.readOnly,
  };
}
