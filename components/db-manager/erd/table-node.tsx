"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KeyRound, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ErdTableNodeData } from "@/lib/erd/graph";

type ErdNode = Node<ErdTableNodeData, "erdTable">;

export function ErdTableNode({ data }: NodeProps<ErdNode>) {
  return (
    <div
      className={cn(
        "min-w-[280px] max-w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        data.highlighted ? "ring-2 ring-primary/60" : "",
      )}
    >
      <div className="border-b border-border bg-muted/70 px-3 py-2">
        <p className="truncate text-sm font-semibold">{data.table.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[data.table.database, data.table.schema].filter(Boolean).join(" / ") || "default"}
        </p>
      </div>
      <div className="divide-y divide-border">
        {data.table.columns.map((column) => (
          <div key={column.id} className="relative grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2">
            <Handle
              type="target"
              id={column.id}
              position={Position.Left}
              className="!h-2.5 !w-2.5 !border-2 !border-card !bg-primary"
            />
            <div className="flex min-w-0 items-center gap-1.5">
              {column.isPrimaryKey ? <KeyRound className="h-3 w-3 shrink-0 text-amber-500" /> : null}
              {column.isForeignKey ? <Link2 className="h-3 w-3 shrink-0 text-primary" /> : null}
              <span className="truncate text-xs font-medium">{column.name}</span>
              <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                {column.nullable ? "null" : "not null"}
              </span>
            </div>
            <span className="truncate text-[11px] text-muted-foreground">{column.type}</span>
            <Handle
              type="source"
              id={column.id}
              position={Position.Right}
              className="!h-2.5 !w-2.5 !border-2 !border-card !bg-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
