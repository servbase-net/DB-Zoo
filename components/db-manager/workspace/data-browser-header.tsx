"use client";

import { Database, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DataBrowserHeader({
  table,
  database,
  schema,
  filter,
  onFilterChange,
  onRefresh,
  onExportCsv,
  onExportSql,
}: {
  table: string;
  database: string;
  schema: string;
  filter: string;
  onFilterChange: (value: string) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportSql: () => void;
}) {
  return (
    <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-medium">{table}</h1>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {database}.{schema}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            className="h-8 border-neutral-300 bg-neutral-100 px-2 text-xs hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            onClick={onExportCsv}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            className="h-8 border-neutral-300 bg-neutral-100 px-2 text-xs hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            onClick={onExportSql}
          >
            <Database className="mr-1 h-3.5 w-3.5" />
            SQL
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 border-neutral-300 bg-neutral-100 p-0 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            onClick={onRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Input
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
        placeholder="Filter rows (eg: name=alice)"
        className="h-8 border-neutral-200 bg-white text-xs dark:border-neutral-800 dark:bg-neutral-900"
      />
    </div>
  );
}

