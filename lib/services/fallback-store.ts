import { randomUUID } from "crypto";
import type { ConnectionInput } from "@/lib/types/db";
import type { AppRole } from "@/lib/types/auth";

type SavedConnectionRecord = {
  id: string;
  name: string;
  engine: ConnectionInput["engine"];
  host?: string;
  port?: number;
  username?: string;
  encryptedPassword?: string | null;
  databaseName?: string;
  sqlitePath?: string;
  readOnly: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  label: string;
  input: ConnectionInput;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type HistoryRecord = {
  id: string;
  sessionId: string;
  engine: string;
  queryText: string;
  durationMs: number;
  affectedRows?: number | null;
  success: boolean;
  errorMessage?: string | null;
  executedAt: Date;
};

type AuditRecord = {
  id: string;
  actorRole: AppRole;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: string | null;
  createdAt: Date;
};

const globalStore = globalThis as unknown as {
  servbaseStore?: {
    savedConnections: SavedConnectionRecord[];
    sessions: SessionRecord[];
    history: HistoryRecord[];
    audits: AuditRecord[];
  };
};

function store() {
  if (!globalStore.servbaseStore) {
    globalStore.servbaseStore = {
      savedConnections: [],
      sessions: [],
      history: [],
      audits: [],
    };
  }
  return globalStore.servbaseStore;
}

export function fallbackSaveConnection(input: Omit<SavedConnectionRecord, "id" | "createdAt" | "updatedAt">) {
  const now = new Date();
  const row = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  store().savedConnections.unshift(row);
  return row;
}

export function fallbackListConnections() {
  return store().savedConnections;
}

export function fallbackUpdateConnection(id: string, patch: Partial<SavedConnectionRecord>) {
  const idx = store().savedConnections.findIndex((row) => row.id === id);
  if (idx < 0) throw new Error("Connection not found");
  const next = { ...store().savedConnections[idx], ...patch, updatedAt: new Date() };
  store().savedConnections[idx] = next;
  return next;
}

export function fallbackDeleteConnection(id: string) {
  store().savedConnections = store().savedConnections.filter((row) => row.id !== id);
}

export function fallbackFindConnection(id: string) {
  return store().savedConnections.find((row) => row.id === id) ?? null;
}

export function fallbackCreateSession(input: { label: string; connection: ConnectionInput; expiresAt: Date }) {
  const now = new Date();
  const row: SessionRecord = {
    id: randomUUID(),
    label: input.label,
    input: input.connection,
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  store().sessions.unshift(row);
  return row;
}

export function fallbackListSessions() {
  const now = new Date();
  store().sessions = store().sessions.filter((session) => session.expiresAt > now);
  return store().sessions;
}

export function fallbackGetSession(id: string) {
  return fallbackListSessions().find((session) => session.id === id) ?? null;
}

export function fallbackAddHistory(input: Omit<HistoryRecord, "id" | "executedAt">) {
  store().history.unshift({
    ...input,
    id: randomUUID(),
    executedAt: new Date(),
  });
}

export function fallbackListHistory(sessionId: string) {
  return store().history.filter((row) => row.sessionId === sessionId).slice(0, 100);
}

export function fallbackAddAudit(input: Omit<AuditRecord, "id" | "createdAt">) {
  store().audits.unshift({
    ...input,
    id: randomUUID(),
    createdAt: new Date(),
  });
}
