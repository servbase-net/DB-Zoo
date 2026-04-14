"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TableSearchInput({
  value,
  onChange,
  placeholder = "Search tables",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-8 items-center rounded-md border border-neutral-200 bg-white px-2 dark:border-neutral-800 dark:bg-neutral-900">
      <Search className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-7 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

