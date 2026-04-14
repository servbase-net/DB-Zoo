"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Play, TerminalSquare, X } from "lucide-react";
import { toast } from "sonner";
import { useActiveDbContext } from "@/hooks/use-active-db-context";
import { useWorkspaceTabs } from "@/hooks/use-workspace-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatabaseWorkspaceLayout } from "@/components/db-manager/workspace/database-workspace-layout";
import { ResourceTabs } from "@/components/db-manager/workspace/resource-tabs";
import { DataBrowserHeader } from "@/components/db-manager/workspace/data-browser-header";
import { DataBrowserTable, type SortDirection } from "@/components/db-manager/workspace/data-browser-table";
import { PaginationControls } from "@/components/db-manager/workspace/pagination-controls";
import { EmptyState } from "@/components/db-manager/workspace/empty-state";
import { SelectionToolbar } from "@/components/db-manager/workspace/selection-toolbar";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type MetaResponse = {
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string | null;
    isPrimaryKey?: boolean;
    isAutoIncrement?: boolean;
  }[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
  foreignKeys: { name: string; column: string; referenceTable: string; referenceColumn: string }[];
};

type RowsResponse = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

type QueryResultPayload = {
  columns?: string[];
  rows?: Record<string, unknown>[];
  durationMs: number;
  affectedRows?: number;
};

export function TableBrowser({
  connectionId,
  database,
  schema,
  table,
}: {
  connectionId: string;
  database: string;
  schema: string;
  table: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setContext } = useActiveDbContext();
  const currentHref = `/tables/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;
  const { tabs, currentTableTab, closeTab } = useWorkspaceTabs({ database, schema, table, href: currentHref });

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [rows, setRows] = useState<RowsResponse | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [importPayload, setImportPayload] = useState("");
  const [importFormat, setImportFormat] = useState<"csv" | "sql">("csv");
  const [selectedImportFile, setSelectedImportFile] = useState<string>("");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<string>();
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    row: Record<string, unknown>;
    rowKey: string;
    column: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [activeDataTab, setActiveDataTab] = useState("rows");
  const [showInlineQueryConsole, setShowInlineQueryConsole] = useState(false);
  const [inlineTableQuery, setInlineTableQuery] = useState(`SELECT * FROM ${table} LIMIT 50;`);
  const [inlineQueryRunning, setInlineQueryRunning] = useState(false);
  const [inlineQueryResult, setInlineQueryResult] = useState<QueryResultPayload | null>(null);
  const [tabTableQuery, setTabTableQuery] = useState(`SELECT * FROM ${table} LIMIT 50;`);
  const [tabQueryRunning, setTabQueryRunning] = useState(false);
  const [tabQueryResult, setTabQueryResult] = useState<QueryResultPayload | null>(null);

  const primaryKeys = useMemo(
    () => (meta?.columns ?? []).filter((column) => column.isPrimaryKey).map((column) => column.name),
    [meta],
  );
  const gridColumns = useMemo(
    () => (rows?.rows[0] ? Object.keys(rows.rows[0]) : meta?.columns.map((column) => column.name) ?? []),
    [rows?.rows, meta?.columns],
  );

  const sortedRows = useMemo(() => {
    const base = [...(rows?.rows ?? [])];
    if (!sortBy) return base;
    base.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const aString = String(av).toLowerCase();
      const bString = String(bv).toLowerCase();
      if (aString === bString) return 0;
      const cmp = aString > bString ? 1 : -1;
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return base;
  }, [rows?.rows, sortBy, sortDirection]);

  const getRowKey = useCallback(
    (row: Record<string, unknown>, idx: number) => {
      if (primaryKeys.length > 0) {
        const keyParts = primaryKeys.map((primaryKey) => `${primaryKey}:${String(row[primaryKey] ?? "")}`);
        if (keyParts.some((part) => !part.endsWith(":"))) {
          return keyParts.join("|");
        }
      }
      return `idx:${idx}`;
    },
    [primaryKeys],
  );

  const rowKeyMap = useMemo(() => sortedRows.map((row, idx) => getRowKey(row, idx)), [sortedRows, getRowKey]);
  const allRowsSelected = useMemo(
    () => rowKeyMap.length > 0 && rowKeyMap.every((key) => selectedRowKeys.has(key)),
    [rowKeyMap, selectedRowKeys],
  );

  const loadMeta = useCallback(async () => {
    const qs = new URLSearchParams({ sessionId: connectionId, database, schema, table });
    const res = await fetch(`/api/tables/meta?${qs.toString()}`);
    const payload = await res.json();
    if (payload.ok) setMeta(payload.data);
  }, [connectionId, database, schema, table]);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: "50", filter });
      const res = await fetch(`/api/tables/${connectionId}/${database}/${schema}/${table}/rows?${qs.toString()}`);
      const payload = await res.json();
      if (payload.ok) setRows(payload.data);
    } finally {
      setLoadingRows(false);
    }
  }, [connectionId, database, schema, table, page, filter]);

  useEffect(() => {
    setContext({ database, schema });
  }, [database, schema, setContext]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setNewRow((prev) => {
      const next: Record<string, string> = {};
      for (const column of gridColumns) {
        next[column] = prev[column] ?? "";
      }
      return next;
    });
  }, [gridColumns]);

  useEffect(() => {
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      for (const column of gridColumns) next[column] = prev[column] ?? 180;
      return next;
    });
  }, [gridColumns]);

  useEffect(() => {
    setSelectedRowKeys(new Set());
  }, [rows?.rows, page, filter]);

  useEffect(() => {
    setInlineTableQuery(`SELECT * FROM ${table} LIMIT 50;`);
    setInlineQueryResult(null);
    setTabTableQuery(`SELECT * FROM ${table} LIMIT 50;`);
    setTabQueryResult(null);
    setActiveDataTab("rows");
    setShowInlineQueryConsole(false);
  }, [table]);

  function beginColumnResize(column: string, startX: number) {
    const initialWidth = columnWidths[column] ?? 180;
    const onMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - startX;
      const nextWidth = Math.max(110, initialWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [column]: nextWidth }));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function getColumnMeta(column: string) {
    return meta?.columns.find((item) => item.name === column);
  }

  function isAutoGeneratedColumn(column: string) {
    return Boolean(getColumnMeta(column)?.isAutoIncrement);
  }

  function parseValueForColumn(column: string, raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.toLowerCase() === "null") return null;
    const type = (getColumnMeta(column)?.type ?? "").toLowerCase();
    if (/(int|decimal|numeric|float|double|real)/.test(type)) {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (/(bool)/.test(type)) {
      if (trimmed.toLowerCase() === "true" || trimmed === "1") return true;
      if (trimmed.toLowerCase() === "false" || trimmed === "0") return false;
    }
    return raw;
  }

  function parseEditedValue(raw: string, original: unknown): unknown {
    if (raw.trim().toLowerCase() === "null") return null;
    if (typeof original === "number") {
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? original : parsed;
    }
    if (typeof original === "boolean") {
      const normalized = raw.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
      return original;
    }
    return raw;
  }

  async function insertRowFromGrid() {
    const rowPayload: Record<string, unknown> = {};
    for (const column of gridColumns) {
      if (isAutoGeneratedColumn(column)) continue;
      const parsed = parseValueForColumn(column, newRow[column] ?? "");
      if (parsed !== undefined) rowPayload[column] = parsed;
    }
    if (Object.keys(rowPayload).length === 0) {
      toast.error("Enter at least one value before inserting");
      return;
    }
    const res = await fetch(`/api/tables/${connectionId}/${database}/${schema}/${table}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "insert", row: rowPayload }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Insert failed");
      return;
    }
    setNewRow((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, ""])));
    toast.success("Row inserted");
    await loadRows();
  }

  async function duplicateRow(row: Record<string, unknown>) {
    const res = await fetch(`/api/tables/${connectionId}/${database}/${schema}/${table}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "duplicate", row }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Duplicate failed");
      return;
    }
    toast.success("Row duplicated");
    await loadRows();
  }

  function getPrimaryKeyPayload(row: Record<string, unknown>) {
    if (primaryKeys.length === 0) return null;
    const payload: Record<string, unknown> = {};
    for (const key of primaryKeys) {
      payload[key] = row[key];
    }
    return payload;
  }

  async function removeRow(row: Record<string, unknown>) {
    const primaryKeyPayload = getPrimaryKeyPayload(row);
    if (!primaryKeyPayload) {
      toast.error("Delete requires a primary key column");
      return;
    }
    const res = await fetch(`/api/tables/${connectionId}/${database}/${schema}/${table}/rows`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryKey: primaryKeyPayload }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Delete failed");
      return;
    }
    toast.success("Row deleted");
    await loadRows();
  }

  async function commitCellEdit() {
    if (!editingCell) {
      setEditingCell(null);
      return;
    }
    const primaryKeyPayload = getPrimaryKeyPayload(editingCell.row);
    if (!primaryKeyPayload) {
      setEditingCell(null);
      toast.error("Update requires a primary key column");
      return;
    }
    const originalValue = editingCell.row[editingCell.column];
    const nextValue = parseEditedValue(editValue, originalValue);
    if (Object.is(originalValue, nextValue)) {
      setEditingCell(null);
      return;
    }
    const payloadRow = { ...editingCell.row, [editingCell.column]: nextValue };
    const res = await fetch(`/api/tables/${connectionId}/${database}/${schema}/${table}/rows`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row: payloadRow,
        primaryKey: primaryKeyPayload,
      }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Update failed");
      return;
    }
    setEditingCell(null);
    toast.success("Cell updated");
    await loadRows();
  }

  async function executeScopedTableQuery(
    sql: string,
    setRunning: (value: boolean) => void,
    setResult: (value: QueryResultPayload | null) => void,
  ) {
    const scopedSql = sql.trim();
    if (!scopedSql) {
      toast.error("Type a SQL query first");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: connectionId, query: scopedSql, database, schema }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        toast.error(payload.error ?? "Query failed");
        return;
      }
      setResult(payload.data as QueryResultPayload);
      toast.success(`Executed in ${payload.data.durationMs}ms`);
    } finally {
      setRunning(false);
    }
  }

  async function runInlineTableQuery() {
    await executeScopedTableQuery(inlineTableQuery, setInlineQueryRunning, setInlineQueryResult);
    await loadRows();
  }

  async function runTabTableQuery() {
    await executeScopedTableQuery(tabTableQuery, setTabQueryRunning, setTabQueryResult);
  }

  async function exportTable(format: "csv" | "sql") {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: connectionId, database, schema, table, format }),
    });
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const content = await res.text();
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${table}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(format: "csv" | "sql") {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: connectionId, database, schema, table, format, payload: importPayload }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Import failed");
      return;
    }
    toast.success(`Imported ${payload.data.inserted} rows`);
    await loadRows();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "sql") setImportFormat("sql");
    if (extension === "csv") setImportFormat("csv");
    setSelectedImportFile(file.name);
    setImportPayload(await file.text());
  }

  function handleSort(column: string) {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDirection("asc");
      return;
    }
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function handleToggleTabClose(tabId: string) {
    const target = tabs.find((item) => item.id === tabId);
    if (!target) return;
    closeTab(tabId);
    if (pathname === target.href) {
      const fallback = tabs.find((item) => item.id !== tabId) ?? currentTableTab;
      router.push(fallback.href);
    }
  }

  async function duplicateSelectedRows() {
    const targets = sortedRows.filter((row, idx) => selectedRowKeys.has(rowKeyMap[idx]));
    if (targets.length === 0) return;
    for (const row of targets) {
      await duplicateRow(row);
    }
    setSelectedRowKeys(new Set());
  }

  async function deleteSelectedRows() {
    const targets = sortedRows.filter((row, idx) => selectedRowKeys.has(rowKeyMap[idx]));
    if (targets.length === 0) return;
    for (const row of targets) {
      await removeRow(row);
    }
    setSelectedRowKeys(new Set());
  }

  function askForConfirmation(title: string, description: string, action: () => Promise<void>) {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-3">
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          const action = confirmAction;
          setConfirmAction(null);
          if (action) void action();
        }}
      />
      <DatabaseWorkspaceLayout
        main={
          <div className="flex h-full min-h-0 flex-col bg-neutral-50 dark:bg-neutral-950">
            <ResourceTabs
              tabs={tabs}
              activeHref={pathname}
              onClose={(tab) => handleToggleTabClose(tab.id)}
              onTabOpen={(tab) => {
                if (tab.id === "query") {
                  setActiveDataTab("rows");
                  setShowInlineQueryConsole(true);
                  return true;
                }
                return false;
              }}
            />
            <DataBrowserHeader
              table={table}
              database={database}
              schema={schema}
              filter={filter}
              onFilterChange={setFilter}
              onRefresh={() => void loadRows()}
              onExportCsv={() => void exportTable("csv")}
              onExportSql={() => void exportTable("sql")}
            />
            <SelectionToolbar
              selectedCount={selectedRowKeys.size}
              onDuplicate={() => void duplicateSelectedRows()}
              onDelete={() =>
                askForConfirmation(
                  "Delete Selected Rows?",
                  `This will permanently delete ${selectedRowKeys.size} selected row(s).`,
                  async () => {
                    await deleteSelectedRows();
                  },
                )
              }
              onClear={() => setSelectedRowKeys(new Set())}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
              <Tabs value={activeDataTab} onValueChange={setActiveDataTab} className="flex min-h-0 flex-1 flex-col">
                <TabsList className="h-8 w-fit rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-900">
                  <TabsTrigger value="rows" className="h-7 px-2 text-xs">
                    Rows
                  </TabsTrigger>
                  <TabsTrigger value="query" className="h-7 px-2 text-xs">
                    Query Console
                  </TabsTrigger>
                  <TabsTrigger value="columns" className="h-7 px-2 text-xs">
                    Columns
                  </TabsTrigger>
                  <TabsTrigger value="indexes" className="h-7 px-2 text-xs">
                    Indexes
                  </TabsTrigger>
                  <TabsTrigger value="fks" className="h-7 px-2 text-xs">
                    Foreign Keys
                  </TabsTrigger>
                  <TabsTrigger value="import" className="h-7 px-2 text-xs">
                    Import
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="rows" className="mt-2 flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="min-h-[220px] flex-1">
                      <DataBrowserTable
                        columns={gridColumns}
                        rows={sortedRows}
                        rowKeyMap={rowKeyMap}
                        selectedRowKeys={selectedRowKeys}
                        onToggleRowSelected={(rowKey) =>
                          setSelectedRowKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(rowKey)) next.delete(rowKey);
                            else next.add(rowKey);
                            return next;
                          })
                        }
                        onToggleAllRowsSelected={() => {
                          if (allRowsSelected) {
                            setSelectedRowKeys(new Set());
                            return;
                          }
                          setSelectedRowKeys(new Set(rowKeyMap));
                        }}
                        allRowsSelected={allRowsSelected}
                        columnWidths={columnWidths}
                        onResizeColumn={beginColumnResize}
                        newRow={newRow}
                        isAutoGeneratedColumn={isAutoGeneratedColumn}
                        onChangeNewRow={(column, value) => setNewRow((prev) => ({ ...prev, [column]: value }))}
                        onInsertRow={() => void insertRowFromGrid()}
                        editingCell={editingCell ? { rowKey: editingCell.rowKey, column: editingCell.column } : null}
                        editValue={editValue}
                        onChangeEditValue={setEditValue}
                        onStartEdit={(row, rowKey, column, value) => {
                          setEditingCell({ row, rowKey, column });
                          setEditValue(value);
                        }}
                        onCommitEdit={() => void commitCellEdit()}
                        onCancelEdit={() => setEditingCell(null)}
                        onDuplicateRow={(row) => void duplicateRow(row)}
                        onDeleteRow={(row) =>
                          askForConfirmation("Delete Row?", "This action cannot be undone.", async () => {
                            await removeRow(row);
                          })
                        }
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        loading={loadingRows}
                      />
                    </div>
                    {!loadingRows && sortedRows.length === 0 ? (
                      <EmptyState title="No Rows Found" description="Try adjusting the filter or insert a new row." />
                    ) : null}
                    <PaginationControls
                      totalRows={rows?.total ?? 0}
                      page={rows?.page ?? 1}
                      pageSize={rows?.pageSize ?? 50}
                      onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
                      onNext={() => setPage((prev) => prev + 1)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="query" className="mt-2 flex min-h-0 flex-1 flex-col">
                  <Card className="border-neutral-200 dark:border-neutral-800">
                    <CardContent className="space-y-2 p-2">
                      <div className="flex items-center justify-between">
                        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                          <TerminalSquare className="h-4 w-4" />
                          SQL Console for {table}
                        </p>
                        <Button size="sm" onClick={() => void runTabTableQuery()} disabled={tabQueryRunning}>
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Run
                        </Button>
                      </div>
                      <Textarea
                        value={tabTableQuery}
                        onChange={(event) => setTabTableQuery(event.target.value)}
                        placeholder="Write SQL query..."
                        className="min-h-[150px] font-mono text-xs"
                      />
                      <div className="max-h-[420px] overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
                        {!tabQueryResult ? (
                          <p className="p-3 text-xs text-neutral-500 dark:text-neutral-400">Run a query to see output.</p>
                        ) : tabQueryResult.rows ? (
                          <Table>
                            <THead>
                              <tr>
                                {(tabQueryResult.columns ?? Object.keys(tabQueryResult.rows[0] ?? {})).map((col) => (
                                  <TH key={col}>{col}</TH>
                                ))}
                              </tr>
                            </THead>
                            <TBody>
                              {tabQueryResult.rows.map((row, idx) => (
                                <tr key={idx}>
                                  {(tabQueryResult.columns ?? Object.keys(row)).map((col) => (
                                    <TD key={`${idx}-${col}`}>{String(row[col] ?? "")}</TD>
                                  ))}
                                </tr>
                              ))}
                            </TBody>
                          </Table>
                        ) : (
                          <p className="p-3 text-xs text-neutral-600 dark:text-neutral-300">
                            Statement executed. Affected rows: {tabQueryResult.affectedRows ?? 0} ({tabQueryResult.durationMs}ms)
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="columns" className="mt-2">
                  <Card className="border-neutral-200 dark:border-neutral-800">
                    <CardContent className="p-0">
                      <Table>
                        <THead>
                          <tr>
                            <TH>Name</TH>
                            <TH>Type</TH>
                            <TH>Nullable</TH>
                            <TH>Default</TH>
                            <TH>PK</TH>
                          </tr>
                        </THead>
                        <TBody>
                          {(meta?.columns ?? []).map((column) => (
                            <tr key={column.name}>
                              <TD>{column.name}</TD>
                              <TD>{column.type}</TD>
                              <TD>{String(column.nullable)}</TD>
                              <TD>{column.defaultValue ?? "-"}</TD>
                              <TD>{column.isPrimaryKey ? "yes" : "no"}</TD>
                            </tr>
                          ))}
                        </TBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="indexes" className="mt-2">
                  <Card className="border-neutral-200 dark:border-neutral-800">
                    <CardContent className="p-0">
                      <Table>
                        <THead>
                          <tr>
                            <TH>Name</TH>
                            <TH>Columns</TH>
                            <TH>Unique</TH>
                          </tr>
                        </THead>
                        <TBody>
                          {(meta?.indexes ?? []).map((index) => (
                            <tr key={index.name}>
                              <TD>{index.name}</TD>
                              <TD>{index.columns.join(", ")}</TD>
                              <TD>{index.unique ? "yes" : "no"}</TD>
                            </tr>
                          ))}
                        </TBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="fks" className="mt-2">
                  <Card className="border-neutral-200 dark:border-neutral-800">
                    <CardContent className="p-0">
                      <Table>
                        <THead>
                          <tr>
                            <TH>Name</TH>
                            <TH>Column</TH>
                            <TH>References</TH>
                          </tr>
                        </THead>
                        <TBody>
                          {(meta?.foreignKeys ?? []).map((fk) => (
                            <tr key={fk.name}>
                              <TD>{fk.name}</TD>
                              <TD>{fk.column}</TD>
                              <TD>
                                {fk.referenceTable}.{fk.referenceColumn}
                              </TD>
                            </tr>
                          ))}
                        </TBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="import" className="mt-2">
                  <Card className="border-neutral-200 dark:border-neutral-800">
                    <CardContent className="space-y-2 p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                        <Input type="file" accept=".csv,.sql,text/csv,text/plain,.txt" onChange={handleImportFile} />
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (!importPayload.trim()) {
                              toast.error("Select or paste a file first");
                              return;
                            }
                            void importData(importFormat);
                          }}
                        >
                          Import file
                        </Button>
                        <p className="self-center text-xs text-neutral-500 dark:text-neutral-400">
                          {selectedImportFile ? `${selectedImportFile} (${importFormat.toUpperCase()})` : "No file selected"}
                        </p>
                      </div>
                      <Textarea
                        placeholder="Paste CSV or SQL content"
                        value={importPayload}
                        onChange={(event) => setImportPayload(event.target.value)}
                        className="min-h-[180px]"
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => void importData("csv")}>
                          Import CSV
                        </Button>
                        <Button variant="outline" onClick={() => void importData("sql")}>
                          Import SQL
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              {showInlineQueryConsole ? (
                <Card className="h-[240px] shrink-0 overflow-hidden border-neutral-200 dark:border-neutral-800">
                  <CardContent className="flex h-full flex-col space-y-2 p-2">
                    <div className="flex items-center justify-between">
                      <p className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                        <TerminalSquare className="h-4 w-4" />
                        SQL Console for {table}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => void runInlineTableQuery()} disabled={inlineQueryRunning}>
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Run
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowInlineQueryConsole(false)}
                          title="Close console"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={inlineTableQuery}
                      onChange={(event) => setInlineTableQuery(event.target.value)}
                      placeholder="Write SQL query..."
                      className="min-h-[130px] flex-1 font-mono text-xs"
                    />
                    <p className="rounded-md border border-neutral-200 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                      {inlineQueryResult
                        ? `Executed in ${inlineQueryResult.durationMs}ms. Rows table above has been refreshed.`
                        : "Run SQL here and the rows table above will refresh automatically."}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        }
      />
    </div>
  );
}
