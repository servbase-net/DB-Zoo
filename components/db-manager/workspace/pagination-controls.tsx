"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PaginationControls({
  totalRows,
  page,
  pageSize,
  onPrev,
  onNext,
}: {
  totalRows: number;
  page: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        {totalRows.toLocaleString()} rows
        <span className="px-1">|</span>
        page {page}
      </p>
      <div className="flex items-center gap-2">
        <Input value={String(pageSize)} readOnly className="h-7 w-14 border-neutral-200 bg-neutral-100 px-2 text-center text-xs dark:border-neutral-800 dark:bg-neutral-900" />
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 border-neutral-300 bg-neutral-100 p-0 dark:border-neutral-700 dark:bg-neutral-900"
          onClick={onPrev}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 border-neutral-300 bg-neutral-100 p-0 dark:border-neutral-700 dark:bg-neutral-900"
          onClick={onNext}
          disabled={totalRows < page * pageSize}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

