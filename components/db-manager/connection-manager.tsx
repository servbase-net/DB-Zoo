"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Pencil, Plug, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useActiveSession } from "@/hooks/use-active-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DatabaseEngine } from "@/lib/types/db";
import { getDefaultPort } from "@/lib/utils";

type ConnectionRecord = {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host: string | null;
  port: number | null;
  username: string | null;
  databaseName: string | null;
  sqlitePath: string | null;
  readOnly: boolean;
  tags: string[];
};

const initialForm = {
  name: "",
  engine: "mysql" as DatabaseEngine,
  host: "127.0.0.1",
  port: 3306,
  username: "root",
  password: "",
  databaseName: "",
  sqlitePath: "",
  readOnly: false,
};

export function ConnectionManager() {
  const router = useRouter();
  const { setSessionId } = useActiveSession();
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function loadConnections() {
    const res = await fetch("/api/connections");
    const payload = await res.json();
    if (payload.ok) {
      setConnections(payload.data);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function save() {
    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/connections/${editingId}` : "/api/connections";
    const body = editingId ? form : { ...form, tags: [] };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Unable to save connection");
      return;
    }
    toast.success("Connection saved");
    setOpen(false);
    resetForm();
    await loadConnections();
  }

  async function connect(savedConnectionId: string) {
    const res = await fetch("/api/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedConnectionId }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Unable to connect");
      return;
    }
    setSessionId(payload.data.sessionId);
    toast.success("Connected");
    router.push("/explorer");
  }

  async function test(id: string) {
    const res = await fetch(`/api/connections/${id}/test`, { method: "POST" });
    const payload = await res.json();
    if (payload.ok) {
      toast.success(`Connected in ${payload.data.latencyMs ?? 0}ms`);
    } else {
      toast.error(payload.error ?? "Test failed");
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (!payload.ok) {
      toast.error(payload.error ?? "Unable to delete");
      return;
    }
    await loadConnections();
  }

  function beginEdit(connection: ConnectionRecord) {
    setEditingId(connection.id);
    setForm({
      ...initialForm,
      name: connection.name,
      engine: connection.engine,
      host: connection.host ?? "",
      port: connection.port ?? getDefaultPort(connection.engine),
      username: connection.username ?? "",
      databaseName: connection.databaseName ?? "",
      sqlitePath: connection.sqlitePath ?? "",
      readOnly: connection.readOnly,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connections</h1>
          <p className="text-sm text-muted-foreground">Manage encrypted credentials and read-only policies.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(state) => {
            setOpen(state);
            if (!state) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add connection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit connection" : "Add connection"}</DialogTitle>
              <DialogDescription>Credentials are encrypted at rest with APP_ENCRYPTION_KEY.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label>Engine</Label>
                <Select
                  value={form.engine}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      engine: e.target.value as DatabaseEngine,
                      port: getDefaultPort(e.target.value),
                    }))
                  }
                >
                  <option value="mysql">MySQL</option>
                  <option value="mariadb">MariaDB</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="sqlite">SQLite</option>
                </Select>
              </div>
              {form.engine !== "sqlite" ? (
                <>
                  <div>
                    <Label>Host</Label>
                    <Input value={form.host} onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm((prev) => ({ ...prev, port: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Database (optional)</Label>
                    <Input
                      value={form.databaseName}
                      onChange={(e) => setForm((prev) => ({ ...prev, databaseName: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label>SQLite path</Label>
                  <Input
                    value={form.sqlitePath}
                    onChange={(e) => setForm((prev) => ({ ...prev, sqlitePath: e.target.value }))}
                  />
                </div>
              )}
              <Button onClick={save} className="w-full">
                {editingId ? "Update connection" : "Save connection"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((connection) => (
          <Card key={connection.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{connection.name}</CardTitle>
                <div className="flex gap-1">
                  <Badge>{connection.engine}</Badge>
                  {connection.readOnly ? <Badge variant="outline">read-only</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {connection.host
                  ? `${connection.host}:${connection.port} • ${connection.username ?? "unknown"}`
                  : connection.sqlitePath}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => connect(connection.id)}>
                  <Plug className="mr-1 h-3 w-3" />
                  Connect
                </Button>
                <Button variant="outline" size="sm" onClick={() => test(connection.id)}>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => beginEdit(connection)}>
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(connection.id)}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
