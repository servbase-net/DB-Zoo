"use client";

import { Download, RefreshCcw, ScanLine, Search, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DiagramToolbar({
  search,
  onSearchChange,
  onRefresh,
  onFitView,
  onAutoLayout,
  onExport,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onFitView: () => void;
  onAutoLayout: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search table..."
          className="pl-9"
        />
      </div>
      <Button variant="outline" onClick={onRefresh}>
        <RefreshCcw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
      <Button variant="outline" onClick={onFitView}>
        <Target className="mr-2 h-4 w-4" />
        Fit view
      </Button>
      <Button variant="outline" onClick={onAutoLayout}>
        <ScanLine className="mr-2 h-4 w-4" />
        Auto layout
      </Button>
      <Button variant="outline" onClick={onExport}>
        <Download className="mr-2 h-4 w-4" />
        Export JSON
      </Button>
    </div>
  );
}
