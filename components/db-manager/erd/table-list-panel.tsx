"use client";

import type { ErdTable } from "@/lib/erd/types";
import { cn } from "@/lib/utils";

export function TableListPanel({
  tables,
  selectedTableId,
  onSelectTable,
}: {
  tables: ErdTable[];
  selectedTableId?: string;
  onSelectTable: (tableId: string) => void;
}) {
  return (
    <aside className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">Tables</p>
        <p className="text-xs text-muted-foreground">{tables.length} visible</p>
      </div>
      <div className="max-h-[68vh] space-y-1 overflow-auto p-2">
        {tables.map((table) => (
          <button
            key={table.id}
            type="button"
            className={cn(
              "w-full rounded-md border border-transparent px-2 py-2 text-left hover:bg-muted",
              selectedTableId === table.id ? "border-primary/40 bg-primary/10" : "",
            )}
            onClick={() => onSelectTable(table.id)}
          >
            <p className="truncate text-sm font-medium">{table.name}</p>
            <p className="truncate text-xs text-muted-foreground">{table.columns.length} columns</p>
          </button>
        ))}
      </div>
    </aside>
  );
}
