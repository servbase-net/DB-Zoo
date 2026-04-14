"use client";

import { Database, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/db-manager/workspace/table-search-input";
import { cn } from "@/lib/utils";

export type SidebarTableItem = {
  name: string;
  href: string;
};

export function TablesSidebar({
  tables,
  selectedTable,
  search,
  onSearchChange,
  onSelectTable,
  onCreateTable,
}: {
  tables: SidebarTableItem[];
  selectedTable?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectTable: (item: SidebarTableItem) => void;
  onCreateTable?: () => void;
}) {
  return (
    <aside className="flex h-full flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Tables</h2>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 w-8 rounded-full bg-neutral-200 p-0 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            onClick={onCreateTable}
            title="Create table"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <TableSearchInput value={search} onChange={onSearchChange} />
      </div>

      <div className="flex-1 overflow-auto p-2">
        {tables.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            No tables found
          </div>
        ) : (
          <div className="space-y-1">
            {tables.map((item) => {
              const active = selectedTable === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onSelectTable(item)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors",
                    active
                      ? "bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white",
                  )}
                >
                  {active ? <Table2 className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

