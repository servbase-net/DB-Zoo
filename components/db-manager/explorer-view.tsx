"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Database, Folder, Table2 } from "lucide-react";
import { useActiveSession } from "@/hooks/use-active-session";
import { useActiveDbContext } from "@/hooks/use-active-db-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type ExplorerResponse = {
  databases: { name: string }[];
  schemas: { name: string }[];
  objects: { name: string; kind: "table" | "view" | "function"; schema?: string }[];
  selectedDatabase?: string;
  selectedSchema?: string;
  objectsPage?: number;
  objectsPageSize?: number;
  objectsTotal?: number;
  objectsHasMore?: boolean;
};

export function ExplorerView() {
  const { sessionId } = useActiveSession();
  const { database: activeDatabase, schema: activeSchema, setContext, isReady } = useActiveDbContext();
  const [data, setData] = useState<ExplorerResponse | null>(null);
  const [objectsPage, setObjectsPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (db?: string, sch?: string, page?: number) => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      const qs = new URLSearchParams({ sessionId });
      if (db) qs.set("database", db);
      if (sch) qs.set("schema", sch);
      qs.set("objectsPage", String(page ?? 1));
      qs.set("objectsPageSize", "100");
      const res = await fetch(`/api/explorer?${qs.toString()}`);
      const payload = await res.json();
      if (payload.ok) {
        setData(payload.data);
        const nextDatabase = payload.data.selectedDatabase ?? "";
        const nextSchema = payload.data.selectedSchema ?? "";
        if (nextDatabase !== activeDatabase || nextSchema !== activeSchema) {
          setContext({ database: nextDatabase, schema: nextSchema });
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, activeDatabase, activeSchema, setContext]);

  useEffect(() => {
    if (!sessionId || !isReady) return;
    void load(activeDatabase || undefined, activeSchema || undefined, objectsPage);
  }, [sessionId, isReady, load, activeDatabase, activeSchema, objectsPage]);

  if (!sessionId) {
    return <p className="text-sm text-muted-foreground">No active session. Connect from the login screen.</p>;
  }

  const selectedDatabase = activeDatabase || data?.selectedDatabase || "";
  const selectedSchema = activeSchema || data?.selectedSchema || "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Schema Explorer</h1>
        <p className="text-sm text-muted-foreground">Browse databases, schemas, tables, views, and functions.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Database</p>
          <Select
            value={selectedDatabase}
            searchable
            searchPlaceholder="Search database..."
            onChange={(event) => {
              const nextDatabase = event.target.value;
              setContext({ database: nextDatabase, schema: "" });
              setObjectsPage(1);
              void load(nextDatabase, undefined, 1);
            }}
          >
            {data?.databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Schema</p>
          <Select
            value={selectedSchema}
            searchable
            searchPlaceholder="Search schema..."
            onChange={(event) => {
              const nextSchema = event.target.value;
              setContext({ schema: nextSchema });
              setObjectsPage(1);
              void load(selectedDatabase, nextSchema, 1);
            }}
          >
            {data?.schemas.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Objects
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {data?.objectsTotal ? `${data.objectsTotal} total` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading ? <p className="px-2 py-1 text-xs text-muted-foreground">Loading objects...</p> : null}
          {data?.objects.map((object) => (
            <Link
              key={`${object.kind}:${object.name}`}
              href={`/tables/${sessionId}/${selectedDatabase}/${selectedSchema}/${object.name}`}
              className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {object.kind === "table" ? (
                <Table2 className="h-4 w-4 text-primary" />
              ) : object.kind === "view" ? (
                <Folder className="h-4 w-4 text-emerald-500" />
              ) : (
                <Database className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm">{object.name}</span>
              <span className="ml-auto text-xs uppercase text-muted-foreground">{object.kind}</span>
            </Link>
          ))}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={objectsPage <= 1 || isLoading}
              onClick={() => setObjectsPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data?.objectsHasMore || isLoading}
              onClick={() => setObjectsPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
