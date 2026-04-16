"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KeyRound, Link2, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ErdTableNodeData } from "@/lib/erd/graph";

type ErdNode = Node<ErdTableNodeData, "erdTable">;

export function ErdTableNode({ data, selected }: NodeProps<ErdNode>) {
  return (
    <div
      className={cn(
        "erd-node-container min-w-[260px] overflow-hidden rounded-lg border bg-card shadow-2xl",
        selected || data.highlighted 
          ? "border-emerald-500 ring-1 ring-emerald-500/50" 
          : "border-border"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2.5">
        <Table2 className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-bold text-foreground uppercase tracking-wider">
          {data.table.name}
        </span>
      </div>

      <div className="flex flex-col py-1">
        {data.table.columns.map((column) => (
          <div 
            key={column.id} 
            className="relative flex items-center justify-between px-3 py-1.5 hover:bg-emerald-500/10"
          >
            <Handle type="target" id={column.id} position={Position.Left} />

            <div className="flex items-center gap-2">
              {column.isPrimaryKey ? (
                <KeyRound className="h-3 w-3 text-emerald-500" />
              ) : column.isForeignKey ? (
                <Link2 className="h-3 w-3 text-muted-foreground" />
              ) : (
                <div className="w-3" /> 
              )}
              <span className={cn(
                "text-[13px]",
                column.isPrimaryKey ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-foreground"
              )}>
                {column.name}
              </span>
            </div>

            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              {column.type}
            </span>

            <Handle type="source" id={column.id} position={Position.Right} />
          </div>
        ))}
      </div>
    </div>
  );
}