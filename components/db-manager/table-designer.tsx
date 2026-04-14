"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveSession } from "@/hooks/use-active-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type DraftColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  primaryKey: boolean;
  autoIncrement: boolean;
};

export function TableDesigner() {
  const { sessionId } = useActiveSession();
  const [database, setDatabase] = useState("servbase_demo");
  const [schema, setSchema] = useState("public");
  const [table, setTable] = useState("");
  const [columns, setColumns] = useState<DraftColumn[]>([
    { name: "id", type: "INTEGER", nullable: false, defaultValue: "", primaryKey: true, autoIncrement: true },
  ]);

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      { name: "", type: "VARCHAR(255)", nullable: true, defaultValue: "", primaryKey: false, autoIncrement: false },
    ]);
  }

  function patchColumn(index: number, patch: Partial<DraftColumn>) {
    setColumns((prev) => prev.map((column, idx) => (idx === index ? { ...column, ...patch } : column)));
  }

  function removeColumn(index: number) {
    setColumns((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function create() {
    if (!sessionId) {
      toast.error("No active session");
      return;
    }
    const res = await fetch("/api/tables/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        database,
        schema,
        table,
        columns: columns.map((column) => ({
          ...column,
          defaultValue: column.defaultValue || null,
        })),
      }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Failed to create table");
      return;
    }
    toast.success("Table created");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Table Designer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Database</Label>
            <Input value={database} onChange={(e) => setDatabase(e.target.value)} />
          </div>
          <div>
            <Label>Schema</Label>
            <Input value={schema} onChange={(e) => setSchema(e.target.value)} />
          </div>
          <div>
            <Label>Table name</Label>
            <Input value={table} onChange={(e) => setTable(e.target.value)} />
          </div>
        </div>
        <div className="space-y-3">
          {columns.map((column, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-6">
              <Input
                placeholder="name"
                value={column.name}
                onChange={(e) => patchColumn(index, { name: e.target.value })}
              />
              <Select value={column.type} onChange={(e) => patchColumn(index, { type: e.target.value })}>
                <option>INTEGER</option>
                <option>VARCHAR(255)</option>
                <option>TEXT</option>
                <option>TIMESTAMP</option>
                <option>BOOLEAN</option>
                <option>DECIMAL(10,2)</option>
              </Select>
              <Input
                placeholder="default"
                value={column.defaultValue}
                onChange={(e) => patchColumn(index, { defaultValue: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={column.nullable}
                  onChange={(e) => patchColumn(index, { nullable: e.target.checked })}
                />
                Nullable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={column.primaryKey}
                  onChange={(e) => patchColumn(index, { primaryKey: e.target.checked })}
                />
                PK
              </label>
              <Button variant="destructive" size="sm" onClick={() => removeColumn(index)}>
                <Trash2 className="mr-1 h-3 w-3" />
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addColumn}>
            <Plus className="mr-2 h-4 w-4" />
            Add column
          </Button>
          <Button onClick={create}>Create table</Button>
        </div>
      </CardContent>
    </Card>
  );
}
