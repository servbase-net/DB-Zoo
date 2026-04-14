"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Play } from "lucide-react";
import { toast } from "sonner";
import { useActiveSession } from "@/hooks/use-active-session";
import { useActiveDbContext } from "@/hooks/use-active-db-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { classifyQueryRisk } from "@/lib/db/query-safety";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type QueryResultPayload = {
  columns?: string[];
  rows?: Record<string, unknown>[];
  durationMs: number;
  affectedRows?: number;
};

type HistoryItem = {
  id: string;
  queryText: string;
  success: boolean;
  durationMs: number;
  executedAt: string;
};

const defaultQuery = "SELECT * FROM customers LIMIT 50;";

export function QueryWorkbench() {
  const { sessionId } = useActiveSession();
  const { database, schema } = useActiveDbContext();
  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<QueryResultPayload | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const risk = useMemo(() => classifyQueryRisk(query), [query]);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/query?sessionId=${sessionId}`);
    const payload = await res.json();
    if (payload.ok) setHistory(payload.data);
  }, [sessionId]);

  useEffect(() => {
    loadHistory();
  }, [sessionId, loadHistory]);

  const runUnsafe = useCallback(async () => {
    if (!sessionId) {
      toast.error("No active session");
      return;
    }
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, query, database: database || undefined, schema: schema || undefined }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Query failed");
      return;
    }
    setResult(payload.data);
    toast.success(`Executed in ${payload.data.durationMs}ms`);
    loadHistory();
  }, [sessionId, query, database, schema, loadHistory]);

  const run = useCallback(async () => {
    if (risk === "destructive") {
      setConfirmOpen(true);
      return;
    }
    await runUnsafe();
  }, [risk, runUnsafe]);

  useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, [run]);

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        title="Run Destructive Query?"
        description="This SQL statement looks destructive and may modify or delete data. Continue anyway?"
        confirmLabel="Run Query"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void runUnsafe();
        }}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>SQL Editor</CardTitle>
            <Button onClick={run}>
              <Play className="mr-2 h-4 w-4" />
              Run (Ctrl/Cmd+Enter)
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {risk === "destructive" ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Destructive statement detected. Confirm before execution.
              </div>
            ) : null}
            <MonacoEditor
              language="sql"
              value={query}
              onChange={(value) => setQuery(value ?? "")}
              height="320px"
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Execution time: {result.durationMs}ms
                  {typeof result.affectedRows === "number" ? ` - affected rows: ${result.affectedRows}` : ""}
                </p>
                {result.rows ? (
                  <div className="overflow-auto rounded-lg border border-border">
                    <Table>
                      <THead>
                        <tr>
                          {(result.columns ?? Object.keys(result.rows[0] ?? {})).map((col) => (
                            <TH key={col}>{col}</TH>
                          ))}
                        </tr>
                      </THead>
                      <TBody>
                        {result.rows.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((value, colIdx) => (
                              <TD key={colIdx}>{String(value ?? "")}</TD>
                            ))}
                          </tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm">Statement executed successfully.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run a query to see results.</p>
            )}
          </CardContent>
        </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Query History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="w-full rounded-lg border border-border p-2 text-left hover:bg-muted"
                onClick={() => setQuery(entry.queryText)}
              >
                <p className="line-clamp-2 text-xs">{entry.queryText}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(entry.executedAt).toLocaleString()} - {entry.durationMs}ms
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
