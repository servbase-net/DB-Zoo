import { TableDesigner } from "@/components/db-manager/table-designer";

export default function TablesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Table Tools</h1>
        <p className="text-sm text-muted-foreground">
          Create and alter tables using provider-based engine capabilities.
        </p>
      </div>
      <TableDesigner />
    </div>
  );
}
