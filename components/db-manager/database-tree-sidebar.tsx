"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, FolderTree, Table2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActiveSession } from "@/hooks/use-active-session";
import { useActiveDbContext } from "@/hooks/use-active-db-context";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

export function DatabaseTreeSidebar() {
  const pathname = usePathname();
  const { sessionId } = useActiveSession();
  const { database: activeDatabase, schema: activeSchema, setContext, isReady } = useActiveDbContext();
  const [data, setData] = useState<ExplorerResponse | null>(null);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [tablesSearch, setTablesSearch] = useState("");
  const [objectsPage, setObjectsPage] = useState(1);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  const load = useCallback(
    async (
      db?: string,
      sch?: string,
      options?: {
        includeObjects?: boolean;
        objectsPage?: number;
        objectsPageSize?: number;
        objectsSearch?: string;
      },
    ) => {
      if (!sessionId) return;
      const qs = new URLSearchParams({ sessionId });
      if (db) qs.set("database", db);
      if (sch) qs.set("schema", sch);
      const includeObjects = options?.includeObjects ?? true;
      qs.set("includeObjects", String(includeObjects));
      if (includeObjects) {
        qs.set("objectsPage", String(options?.objectsPage ?? 1));
        qs.set("objectsPageSize", String(options?.objectsPageSize ?? 120));
        qs.set("objectsKind", "table");
        if (options?.objectsSearch?.trim()) {
          qs.set("objectsSearch", options.objectsSearch.trim());
        }
      }

      try {
        if (includeObjects) {
          setIsLoadingTables(true);
        }
        const res = await fetch(`/api/explorer?${qs.toString()}`);
        const payload = await res.json();
        if (!payload.ok) return;
        setData(payload.data);
        const nextDatabase = payload.data.selectedDatabase ?? "";
        const nextSchema = payload.data.selectedSchema ?? "";
        if (nextDatabase !== activeDatabase || nextSchema !== activeSchema) {
          setContext({ database: nextDatabase, schema: nextSchema });
        }
      } finally {
        if (includeObjects) {
          setIsLoadingTables(false);
        }
      }
    },
    [sessionId, activeDatabase, activeSchema, setContext],
  );

  useEffect(() => {
    if (!sessionId || !isReady) return;
    void load(activeDatabase || undefined, activeSchema || undefined, {
      includeObjects: tablesOpen,
      objectsPage,
      objectsPageSize: 120,
      objectsSearch: tablesSearch,
    });
  }, [load, sessionId, activeDatabase, activeSchema, isReady, tablesOpen, objectsPage, tablesSearch]);

  const tables = useMemo(
    () =>
      (data?.objects ?? [])
        .filter((item) => item.kind === "table")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data?.objects],
  );
  const selectedDatabase = activeDatabase || data?.selectedDatabase || "";
  const selectedSchema = activeSchema || data?.selectedSchema || "";
  const hasMoreTables = Boolean(data?.objectsHasMore);
  const objectsStart = (data?.objectsPage && data?.objectsPageSize ? (data.objectsPage - 1) * data.objectsPageSize + 1 : 0);
  const objectsEnd = (data?.objectsPage && data?.objectsPageSize ? (data.objectsPage - 1) * data.objectsPageSize + tables.length : 0);

  return (
    <aside className="overflow-y-auto border-r border-border bg-card/60 p-4 lg:h-screen">
      <div className="mb-5 flex justify-center">
        <Image
          src="/branding/db-zoo-2.png"
          alt="DB Zoo"
          width={140}
          height={60}
          className="select-none"
          draggable={false}
          priority
        />
      </div>

      <div className="pt-2">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FolderTree className="h-3.5 w-3.5" />
          Database Browser
        </div>

        {!sessionId ? (
          <p className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            Connect first to browse tables.
          </p>
        ) : (
          <div className="space-y-2">
            <Select
              value={selectedDatabase}
              searchable
              searchPlaceholder="Search database..."
              onChange={(event) => {
                const nextDatabase = event.target.value;
                setContext({ database: nextDatabase, schema: "" });
                setObjectsPage(1);
                setTablesSearch("");
                void load(nextDatabase, undefined, { includeObjects: tablesOpen, objectsPage: 1, objectsPageSize: 120 });
              }}
              className="h-9 text-xs"
            >
              {(data?.databases ?? []).map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </Select>
            <p className="px-1 text-[11px] text-muted-foreground">Schema: {selectedSchema || "default"}</p>

            <button
              type="button"
              onClick={() => setTablesOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-md border border-border/70 bg-background/60 px-2 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                Tables
              </span>
              {tablesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {tablesOpen ? (
              <div className="space-y-2">
                <Input
                  value={tablesSearch}
                  onChange={(event) => {
                    setTablesSearch(event.target.value);
                    setObjectsPage(1);
                  }}
                  placeholder="Search tables..."
                  className="h-8 text-xs"
                />
                <div className="max-h-[45vh] space-y-1 overflow-auto pr-1">
                  {tables.map((table) => {
                    const href = `/tables/${encodeURIComponent(sessionId)}/${encodeURIComponent(selectedDatabase)}/${encodeURIComponent(selectedSchema)}/${encodeURIComponent(table.name)}`;
                    const active = pathname.includes(`/tables/`) && pathname.endsWith(`/${encodeURIComponent(table.name)}`);
                    return (
                      <Link
                        key={table.name}
                        href={href}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-muted",
                          active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <Table2 className="h-3.5 w-3.5" />
                        <span className="truncate">{table.name}</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                  <span>
                    {data?.objectsTotal ? `${objectsStart}-${objectsEnd} of ${data.objectsTotal}` : `${tables.length} tables`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={objectsPage <= 1 || isLoadingTables}
                      onClick={() => setObjectsPage((current) => Math.max(1, current - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasMoreTables || isLoadingTables}
                      onClick={() => setObjectsPage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
