import { QueryWorkbench } from "@/components/db-manager/query-workbench";

export default function QueryPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold">SQL Editor</h1>
        <p className="text-sm text-muted-foreground">Run queries with history, risk warnings, and result grids.</p>
      </div>
      <QueryWorkbench />
    </div>
  );
}
