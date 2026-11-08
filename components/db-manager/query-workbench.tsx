"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Copy, Download, Play, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useActiveSession } from "@/hooks/use-active-session";
import { useActiveDbContext } from "@/hooks/use-active-db-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { classifyQueryRisk } from "@/lib/db/query-safety";
import { cn } from "@/lib/utils";
import { formatCell, rowsToCsv } from "@/lib/format";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type QueryResultPayload = {
  columns?: string[];
  rows?: Record<string, unknown>[];
  durationMs: number;
  affectedRows?: number;
  truncated?: boolean;
  totalRows?: number;
};

type HistoryItem = {
  id: string;
  queryText: string;
  success: boolean;
  errorMessage?: string | null;
  durationMs: number;
  executedAt: string;
};

const defaultQuery = "SELECT * FROM customers LIMIT 50;";
const MONACO_COLORS = {
  dark: {
    bg: "#0b111ec7",
    fg: "#f5f5f5",
    muted: "#a3a3a3",
    border: "#262626",
    selection: "#264f78",
    lineHL: "#1b263dd5",
  },
  light: {
    bg: "#ffffff",
    fg: "#171717",
    muted: "#737373",
    border: "#e5e5e5",
    selection: "#cce2ff",
    lineHL: "#f8f8f8",
  },
} as const;

const THEME_DARK = "dbzoo-dark";
const THEME_LIGHT = "dbzoo-light";

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "OUTER JOIN",
  "ON",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "AS",
  "AND",
  "OR",
  "NOT",
  "NULL",
  "IS NULL",
  "IS NOT NULL",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "CREATE",
  "ALTER",
  "DROP",
  "TABLE",
  "DATABASE",
  "SCHEMA",
  "INDEX",
  "VIEW",
  "PRIMARY KEY",
  "FOREIGN KEY",
  "REFERENCES",
  "UNION",
  "ALL",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "LIKE",
  "ILIKE",
  "IN",
  "EXISTS",
  "BETWEEN",
  "ASC",
  "DESC",
];

export function QueryWorkbench() {
  const { sessionId } = useActiveSession();
  const { database, schema } = useActiveDbContext();
  const { resolvedTheme } = useTheme();

  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<QueryResultPayload | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SQL that will run: the editor selection if there is one, otherwise the whole editor.
  const pendingSql = useRef("");
  const editorRef = useRef<any>(null);
  const runRef = useRef<() => void>(() => {});
  const schemaNames = useRef<string[]>([]);

  const monacoRef = useRef<any>(null);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);

  const [selection, setSelection] = useState("");
  const sqlToRun = selection.trim() ? selection : query;
  const risk = useMemo(() => classifyQueryRisk(sqlToRun), [sqlToRun]);

  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return history;
    return history.filter((e) => e.queryText.toLowerCase().includes(term));
  }, [history, historySearch]);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/query?sessionId=${encodeURIComponent(sessionId)}`);
      const payload = await res.json();
      if (payload.ok) setHistory(payload.data);
    } catch {
      // history is optional; the editor keeps working without it
    }
  }, [sessionId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Table names for autocomplete.
  useEffect(() => {
    if (!sessionId) return;
    const qs = new URLSearchParams({ sessionId, objectsPageSize: "500", objectsKind: "all" });
    if (database) qs.set("database", database);
    if (schema) qs.set("schema", schema);
    fetch(`/api/explorer?${qs.toString()}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.ok) schemaNames.current = (payload.data.objects ?? []).map((o: { name: string }) => o.name);
      })
      .catch(() => {});
  }, [sessionId, database, schema]);

  const defineMonacoThemes = useCallback((monaco: any) => {
    const define = (name: string, isDark: boolean) => {
      const c = isDark ? MONACO_COLORS.dark : MONACO_COLORS.light;
      monaco.editor.defineTheme(name, {
        base: isDark ? "vs-dark" : "vs",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": c.bg,
          "editor.foreground": c.fg,
          "editorLineNumber.foreground": c.muted,
          "editorLineNumber.activeForeground": c.fg,
          "editor.lineHighlightBackground": c.lineHL,
          "editor.selectionBackground": c.selection,
          "editor.inactiveSelectionBackground": c.selection,
          "editorCursor.foreground": c.fg,
          "editorIndentGuide.background1": c.border,
          "editorIndentGuide.activeBackground1": c.muted,
          "editorBracketMatch.background": c.selection,
          "editorBracketMatch.border": c.muted,
        },
      });
    };

    define(THEME_DARK, true);
    define(THEME_LIGHT, false);
  }, []);

  useEffect(() => {
    if (!monacoRef.current) return;
    monacoRef.current.editor.setTheme(resolvedTheme === "dark" ? THEME_DARK : THEME_LIGHT);
  }, [resolvedTheme]);

  const registerSqlCompletionProvider = useCallback((monaco: any) => {
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", ".", "("],
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = [
          ...SQL_KEYWORDS.map((keyword) => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range,
          })),
          ...schemaNames.current.map((name) => ({
            label: name,
            kind: monaco.languages.CompletionItemKind.Struct,
            insertText: /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`,
            range,
          })),
        ];

        return { suggestions };
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, []);

  const runUnsafe = useCallback(async () => {
    if (!sessionId) {
      toast.error("No active session");
      return;
    }

    const sql = pendingSql.current.trim();
    if (!sql) {
      toast.error("Type a SQL query first");
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query: sql,
          database: database || undefined,
          schema: schema || undefined,
        }),
      });

      const payload = await res.json();

      if (!payload.ok) {
        setError(payload.error ?? "Query failed");
        void loadHistory();
        return;
      }

      setResult(payload.data);
      toast.success(`Executed in ${payload.data.durationMs}ms`);
      void loadHistory();
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsRunning(false);
    }
  }, [sessionId, database, schema, loadHistory]);

  const run = useCallback(async () => {
    const editor = editorRef.current;
    const selected = editor?.getModel()?.getValueInRange(editor.getSelection()) ?? "";
    pendingSql.current = selected.trim() ? selected : editor?.getValue() ?? query;
    if (classifyQueryRisk(pendingSql.current) === "destructive") {
      setConfirmOpen(true);
      return;
    }

    await runUnsafe();
  }, [query, runUnsafe]);

  useEffect(() => {
    runRef.current = () => void run();
  }, [run]);

  const handleEditorMount = useCallback(
    (editor: any, monaco: any) => {
      monacoRef.current = monaco;
      editorRef.current = editor;
      editor.onDidChangeCursorSelection(() => {
        setSelection(editor.getModel()?.getValueInRange(editor.getSelection()) ?? "");
      });
      defineMonacoThemes(monaco);
      registerSqlCompletionProvider(monaco);
      monaco.editor.setTheme(resolvedTheme === "dark" ? THEME_DARK : THEME_LIGHT);

      // runRef: the command is registered once, so it must not capture a stale query
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    },
    [defineMonacoThemes, registerSqlCompletionProvider, resolvedTheme]
  );

  const resultColumns = useMemo(() => {
    if (!result) return [];
    return result.columns ?? Object.keys(result.rows?.[0] ?? {});
  }, [result]);

  function downloadCsv() {
    if (!result?.rows) return;
    const blob = new Blob([rowsToCsv(resultColumns, result.rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "query-result.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>SQL Editor</CardTitle>
              <Button onClick={() => void run()} disabled={isRunning} className="w-full sm:w-auto">
                <Play className="mr-2 h-4 w-4" />
                {isRunning ? "Running…" : selection.trim() ? "Run selection (Ctrl/Cmd+Enter)" : "Run (Ctrl/Cmd+Enter)"}
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {risk === "destructive" && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Destructive statement detected — confirm before execution.
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs">{error}</span>
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-border">
                <MonacoEditor
                  language="sql"
                  value={query}
                  onChange={(v) => setQuery(v ?? "")}
                  onMount={handleEditorMount}
                  height="300px"
                  theme={undefined}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    padding: { top: 12, bottom: 12 },
                    lineNumbers: "on",
                    folding: false,
                    renderLineHighlight: "line",
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: false,
                    },
                    wordBasedSuggestions: "off",
                    suggest: {
                      showWords: false,
                      showSnippets: false,
                    },
                    suggestOnTriggerCharacters: true,
                    tabCompletion: "off",
                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                      verticalScrollbarSize: 6,
                      horizontalScrollbarSize: 6,
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Result</CardTitle>
              {result?.rows?.length ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={downloadCsv} title="Download CSV">
                    <Download className="mr-1 h-3.5 w-3.5" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Copy as CSV"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(rowsToCsv(resultColumns, result.rows!))
                        .then(() => toast.success("Copied"))
                        .catch(() => toast.error("Copy failed"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
              {result && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {result.durationMs}ms
                  {typeof result.affectedRows === "number" && (
                    <> · {result.affectedRows} row{result.affectedRows !== 1 ? "s" : ""} affected</>
                  )}
                </span>
              )}
            </CardHeader>

            <CardContent>
              {result ? (
                result.rows?.length ? (
                  <div className="overflow-auto rounded-lg border border-border">
                    <Table className="min-w-max">
                      <THead>
                        <tr>
                          {resultColumns.map((col) => (
                            <TH key={col}>{col}</TH>
                          ))}
                        </tr>
                      </THead>
                      <TBody>
                        {result.rows!.map((row, idx) => (
                          <tr key={idx}>
                            {resultColumns.map((col) => (
                              <TD
                                key={`${idx}-${col}`}
                                className="max-w-[260px] truncate"
                                title={formatCell(row[col])}
                              >
                                {row[col] === null || row[col] === undefined ? (
                                  <span className="italic text-muted-foreground">NULL</span>
                                ) : (
                                  formatCell(row[col])
                                )}
                              </TD>
                            ))}
                          </tr>
                        ))}
                      </TBody>
                    </Table>
                    {result.truncated && (
                      <p className="border-t border-border p-2 text-xs text-muted-foreground">
                        Showing the first {result.rows!.length.toLocaleString()} of {result.totalRows?.toLocaleString()} rows. Add a LIMIT to narrow it.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {result.columns?.length ? "Query returned no rows." : "Statement executed successfully."}
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Run a query to see results.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-w-0 flex-col xl:h-[calc(100vh-240px)]">
          <CardHeader className="space-y-3 pb-3">
            <CardTitle>Query History</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history…"
                className="pl-9"
              />
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-1.5 overflow-auto xl:max-h-[calc(100vh-360px)]">
              {filteredHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {historySearch ? "No matching queries found." : "No query history yet."}
                </p>
              ) : (
                filteredHistory.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setQuery(entry.queryText);
                      setError(entry.success ? null : (entry.errorMessage ?? null));
                    }}
                    title={entry.errorMessage ?? undefined}
                    className="group w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <p className="line-clamp-2 break-all font-mono text-xs leading-relaxed">
                      {entry.queryText}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{new Date(entry.executedAt).toLocaleString()}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                          entry.success
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {entry.success ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {entry.durationMs}ms
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
