"use client";

import { CopyPlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SelectionToolbar({
  selectedCount,
  onDuplicate,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="flex h-10 items-center justify-between border-b border-neutral-200 bg-neutral-100 px-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-600 dark:text-neutral-300">{selectedCount} row(s) selected</p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onDuplicate}>
          <CopyPlus className="mr-1 h-3.5 w-3.5" />
          Duplicate
        </Button>
        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={onDelete}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClear} title="Clear selection">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

