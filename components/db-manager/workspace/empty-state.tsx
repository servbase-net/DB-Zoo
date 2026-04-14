"use client";

import { DatabaseZap } from "lucide-react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <DatabaseZap className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}

