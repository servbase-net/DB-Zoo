"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Play, Search, XCircle } from "lucide-react";
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

  const monacoRef = useRef<any>(null);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);

  const risk = useMemo(() => classifyQueryRisk(query), [query]);

  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return history;
    return history.filter((e) => e.queryText.toLowerCase().includes(term));
  }, [history, historySearch]);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/query?sessionId=${sessionId}`);
    const payload = await res.json();
    if (payload.ok) setHistory(payload.data);
  }, [sessionId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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

        const suggestions = SQL_KEYWORDS.map((keyword) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        }));

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

    setIsRunning(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query,
          database: database || undefined,
          schema: schema || undefined,
        }),
      });

      const payload = await res.json();

      if (!payload.ok) {
        toast.error(payload.error ?? "Query failed");
        return;
      }

      setResult(payload.data);
      toast.success(`Executed in ${payload.data.durationMs}ms`);
      void loadHistory();
    } finally {
      setIsRunning(false);
    }
  }, [sessionId, query, database, schema, loadHistory]);

  const run = useCallback(async () => {
    if (risk === "destructive") {
      setConfirmOpen(true);
      return;
    }

    await runUnsafe();
  }, [risk, runUnsafe]);

  const handleEditorMount = useCallback(
    (editor: any, monaco: any) => {
      monacoRef.current = monaco;
      defineMonacoThemes(monaco);
      registerSqlCompletionProvider(monaco);
      monaco.editor.setTheme(resolvedTheme === "dark" ? THEME_DARK : THEME_LIGHT);

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void run());
    },
    [defineMonacoThemes, registerSqlCompletionProvider, resolvedTheme, run]
  );

  const resultColumns = useMemo(() => {
    if (!result) return [];
    return result.columns ?? Object.keys(result.rows?.[0] ?? {});
  }, [result]);

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
                {isRunning ? "Running…" : "Run (Ctrl/Cmd+Enter)"}
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {risk === "destructive" && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Destructive statement detected — confirm before execution.
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
                                title={String(row[col] ?? "")}
                              >
                                {String(row[col] ?? "")}
                              </TD>
                            ))}
                          </tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Statement executed successfully.</p>
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
                    onClick={() => setQuery(entry.queryText)}
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
