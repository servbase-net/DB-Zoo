"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Database, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useActiveSession } from "@/hooks/use-active-session";
import type { DatabaseEngine } from "@/lib/types/db";
import { getDefaultPort } from "@/lib/utils";

const engines: { value: DatabaseEngine; label: string }[] = [
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
];

export function LoginForm() {
  const router = useRouter();
  const { setSessionId } = useActiveSession();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    engine: "mysql" as DatabaseEngine,
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    password: "",
    databaseName: "",
    sqlitePath: "",
    saveConnection: false,
    name: "",
    readOnly: false,
  });

  const showNetwork = useMemo(() => form.engine !== "sqlite", [form.engine]);

  const onEngineChange = (engine: DatabaseEngine) => {
    setForm((prev) => ({
      ...prev,
      engine,
      port: getDefaultPort(engine),
      host: engine === "sqlite" ? "" : prev.host || "127.0.0.1",
    }));
  };

  async function connect() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Connection failed");
      }
      setSessionId(payload.data.sessionId as string);
      toast.success("Connected to DB Zoo");
      router.push("/connections");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to connect");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <section className="relative overflow-hidden rounded-3xl px-6 py-10 pb-0 backdrop-blur-xl sm:px-10">
        <div className="pointer-events-none absolute inset-0 " />
        <div className="relative flex flex-col items-center">
          <Image
            src="/branding/db-zoo-2.png"
            alt="DB Zoo logo"
            width={430}
            height={118}
            className="h-auto w-[290px] select-none sm:w-[400px]"
            draggable={false}
            priority
          />
          <p className="mt-5 max-w-2xl text-center text-md font-semibold text-muted-foreground">
            Connect to MySQL, MariaDB, PostgreSQL, and SQLite in one clean workspace.
          </p>
        </div>
      </section>

      <Card className="border-border/70 bg-card/95 shadow-[0_12px_34px_-20px_rgba(0,0,0,0.45)]">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            Connect to Database
          </CardTitle>
          <p className="text-sm text-muted-foreground">Secure session with optional saved connection profile.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Database type</Label>
              <Select value={form.engine} onChange={(e) => onEngineChange(e.target.value as DatabaseEngine)} searchable>
                {engines.map((engine) => (
                  <option value={engine.value} key={engine.value}>
                    {engine.label}
                  </option>
                ))}
              </Select>
            </div>
            {showNetwork ? (
              <div className="space-y-2">
                <Label>Host</Label>
                <Input value={form.host} onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))} />
              </div>
            ) : null}
            {showNetwork ? (
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((prev) => ({ ...prev, port: Number(e.target.value) }))}
                />
              </div>
            ) : null}
            {showNetwork ? (
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
            ) : null}
            {showNetwork ? (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>{form.engine === "sqlite" ? "SQLite file path" : "Database (optional)"}</Label>
              <Input
                value={form.engine === "sqlite" ? form.sqlitePath : form.databaseName}
                onChange={(e) =>
                  setForm((prev) =>
                    form.engine === "sqlite"
                      ? { ...prev, sqlitePath: e.target.value }
                      : { ...prev, databaseName: e.target.value },
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Connection label (if saved)</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.saveConnection}
                  onChange={(e) => setForm((prev) => ({ ...prev, saveConnection: e.target.checked }))}
                />
                Save connection
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.readOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, readOnly: e.target.checked }))}
                />
                Read-only mode
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Connection credentials are encrypted at rest.
            </p>
            <Button
              onClick={connect}
              disabled={isLoading}
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 sm:w-auto"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect
            </Button>
          </div>
        </CardContent>
      </Card>

      <footer className="rounded-2xl px-5 py-4 flex items-center justify-center ">
        <a href="https://servbase.net" target="_blank" className="flex items-center justify-center gap-3 select-none">
          <Image draggable={false} src="/branding/servbase.png" alt="Servbase logo" width={80} height={80} className="h-15 w-15" />
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Powered By</p>
            <p className="text-base font-semibold text-foreground">Servbase</p>
          </div>
        </a>
      </footer>
    </div>
  );
}
