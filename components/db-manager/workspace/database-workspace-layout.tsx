"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

export function DatabaseWorkspaceLayout({
  sidebar,
  main,
}: {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
}) {
  if (!sidebar) {
    return (
      <div className="h-[calc(100vh-140px)] min-h-[560px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        {main}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] min-h-[560px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <Group orientation="horizontal" className="h-full">
        <Panel defaultSize={24} minSize={18} maxSize={36} className="min-w-0">
          {sidebar}
        </Panel>
        <Separator
          className={cn(
            "w-px bg-neutral-200 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700",
          )}
        />
        <Panel defaultSize={76} minSize={50} className="min-w-0">
          {main}
        </Panel>
      </Group>
    </div>
  );
}
