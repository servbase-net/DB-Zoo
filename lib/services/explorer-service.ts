import { getProviderFromSession } from "@/lib/services/connection-service";
import type { DbObjectRef } from "@/lib/types/db";

type ExplorerOptions = {
  includeObjects?: boolean;
  objectsPage?: number;
  objectsPageSize?: number;
  objectsSearch?: string;
  objectsKind?: "all" | "table" | "view" | "function";
};

type CachedObjects = {
  expiresAt: number;
  objects: DbObjectRef[];
};

const OBJECTS_CACHE_TTL_MS = 30_000;
const objectsCache = new Map<string, CachedObjects>();

async function listCachedObjects(
  sessionId: string,
  database: string | undefined,
  schema: string | undefined,
  fetcher: () => Promise<DbObjectRef[]>,
) {
  const key = `${sessionId}:${database ?? ""}:${schema ?? ""}`;
  const cached = objectsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.objects;
  }
  const objects = await fetcher();
  objectsCache.set(key, {
    objects,
    expiresAt: Date.now() + OBJECTS_CACHE_TTL_MS,
  });
  return objects;
}

export async function getExplorerData(sessionId: string, selectedDatabase?: string, selectedSchema?: string, options?: ExplorerOptions) {
  const { provider, input } = await getProviderFromSession(sessionId);
  const databases = await provider.listDatabases(input);
  const database = databases.some((db) => db.name === selectedDatabase) ? selectedDatabase : databases[0]?.name;
  const schemas = await provider.listSchemas(input, database);
  const schema = schemas.some((item) => item.name === selectedSchema) ? selectedSchema : schemas[0]?.name;

  const includeObjects = options?.includeObjects ?? true;
  const objectsPage = options?.objectsPage ?? 1;
  const objectsPageSize = options?.objectsPageSize ?? 100;
  const objectsSearch = options?.objectsSearch?.trim().toLowerCase() ?? "";
  const objectsKind = options?.objectsKind ?? "all";

  let objects: DbObjectRef[] = [];
  let objectsTotal = 0;
  let objectsHasMore = false;

  if (includeObjects) {
    const allObjects = await listCachedObjects(sessionId, database, schema, () =>
      provider.listObjects(input, { database, schema }),
    );
    const filtered = allObjects.filter((item) => {
      const matchesKind = objectsKind === "all" || item.kind === objectsKind;
      const matchesSearch = !objectsSearch || item.name.toLowerCase().includes(objectsSearch);
      return matchesKind && matchesSearch;
    });
    objectsTotal = filtered.length;
    const start = (objectsPage - 1) * objectsPageSize;
    objects = filtered.slice(start, start + objectsPageSize);
    objectsHasMore = start + objects.length < objectsTotal;
  }

  return {
    databases,
    schemas,
    objects,
    selectedDatabase: database,
    selectedSchema: schema,
    objectsPage,
    objectsPageSize,
    objectsTotal,
    objectsHasMore,
  };
}

export async function getServerInfo(sessionId: string) {
  const { provider, input } = await getProviderFromSession(sessionId);
  return provider.getServerInfo(input);
}
