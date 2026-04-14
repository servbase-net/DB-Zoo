"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceTab } from "@/hooks/use-workspace-tabs";

export function ResourceTabs({
  tabs,
  activeHref,
  onClose,
  onTabOpen,
}: {
  tabs: WorkspaceTab[];
  activeHref: string;
  onClose: (tab: WorkspaceTab) => void;
  onTabOpen?: (tab: WorkspaceTab) => boolean | void;
}) {
  return (
    <div className="no-scrollbar flex h-10 overflow-x-auto border-b border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
      {tabs.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <div
            key={tab.id}
            className={cn(
              "group relative flex min-w-[170px] max-w-[260px] items-center border-r border-neutral-200 px-2 text-xs dark:border-neutral-800",
              active
                ? "bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
                : "text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white",
            )}
          >
            <Link
              href={tab.href}
              className="min-w-0 flex-1 truncate py-2"
              onClick={(event) => {
                if (onTabOpen?.(tab)) {
                  event.preventDefault();
                }
              }}
            >
              {tab.label}
            </Link>
            {!tab.pinned ? (
              <button
                type="button"
                className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded opacity-70 hover:bg-neutral-200 hover:opacity-100 dark:hover:bg-neutral-800"
                onClick={() => onClose(tab)}
                title={`Close ${tab.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
