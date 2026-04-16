"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  ShieldCheck,
  Server,
  User,
  Lock,
  ChevronRight,
  Database,
  Code2,
  Cpu,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useActiveSession } from "@/hooks/use-active-session";
import type { DatabaseEngine } from "@/lib/types/db";
import { getDefaultPort, cn } from "@/lib/utils";

const engines: { value: DatabaseEngine; label: string; disabled?: boolean }[] = [
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "postgresql", label: "Postgres" },
  { value: "sqlite", label: "SQLite", disabled: true },
];

type FieldKey = "host" | "port" | "username" | "password" | "databaseName";

export function LoginForm() {
  const router = useRouter();
  const { setSessionId } = useActiveSession();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const hostRef = useRef<HTMLInputElement>(null);
  const portRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const databaseNameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    engine: "mysql" as DatabaseEngine,
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    password: "",
    databaseName: "",
    saveConnection: false,
    name: "",
    readOnly: false,
  });

  const onEngineChange = (engine: DatabaseEngine) => {
    setForm((prev) => ({
      ...prev,
      engine,
      port: getDefaultPort(engine),
    }));
    setErrors((prev) => ({ ...prev, databaseName: undefined }));
  };

  const getInputClassName = (field: FieldKey, withLeftIcon = false, withRightIcon = false) =>
    cn(
      "h-11 rounded-xl border-border/60 bg-background/50 focus-visible:ring-primary/20",
      withLeftIcon && "pl-10",
      withRightIcon && "px-10",
      errors[field] && "border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500"
    );

  async function connect() {
    const nextErrors: Partial<Record<FieldKey, string>> = {};

    if (!form.host.trim()) nextErrors.host = "Host is required";
    if (!form.port) nextErrors.port = "Port is required";
    if (!form.username.trim()) nextErrors.username = "Username is required";
    if (!form.password.trim()) nextErrors.password = "Password is required";
    if (form.engine === "postgresql" && !form.databaseName.trim()) {
      nextErrors.databaseName = "Database is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please fill in all required fields");

      if (nextErrors.host) hostRef.current?.focus();
      else if (nextErrors.port) portRef.current?.focus();
      else if (nextErrors.username) usernameRef.current?.focus();
      else if (nextErrors.password) passwordRef.current?.focus();
      else if (nextErrors.databaseName) databaseNameRef.current?.focus();

      return;
    }

    setErrors({});
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
      toast.success("Connection established");

      if (form.databaseName.trim()) {
        localStorage.setItem("dbzoo.activeDatabase", form.databaseName.trim());
        localStorage.setItem("dbzoo.activeSchema", "");
        window.dispatchEvent(new Event("dbzoo:db-context-changed"));
      }

      router.push("/connections");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to connect");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
      <div className="absolute left-1/2 top-0 -z-10 h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px] sm:h-[420px] sm:w-[420px] lg:left-1/4 lg:h-[520px] lg:w-[520px] lg:translate-x-0" />

      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14 xl:gap-20">
        <div className="order-1 flex flex-col justify-center space-y-6 lg:space-y-10">
          <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 lg:space-y-6 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Image
                src="/branding/db-zoo-2.png"
                alt="DB Zoo"
                width={480}
                height={200}
                priority
                draggable={false}
                className="h-auto w-[180px] select-none sm:w-[280px] lg:w-[340px]"
              />
            </div>

            <div className="space-y-2 lg:space-y-4">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight hidden md:block sm:text-5xl lg:text-6xl xl:text-7xl">
                Modern <br />
                <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  Data Tooling.
                </span>
              </h1>

              <div className="space-y-3">
                <p className="mx-auto lg:mx-0 md:max-w-xl max-w-sm text-base leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
                  Connect to <span className="text-foreground md:font-medium font-semibold">MySQL</span>,{" "}
                  <span className="text-foreground md:font-medium sm:font-semibold">MariaDB</span>,{" "}
                  <span className="text-foreground md:font-medium sm:font-semibold">PostgreSQL</span>, and{" "}
                  <span className="text-foreground md:font-medium sm:font-semibold">SQLite</span> in one clean workspace.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="hidden md:flex flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-8">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-muted-foreground/40">
              <Cpu className="h-3 w-3 sm:h-4 w-4" />
              Next.js
            </div>
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-muted-foreground/40">
              <Code2 className="h-3 w-3 sm:h-4 w-4" />
              Type-Safe
            </div>
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-muted-foreground/40">
              <ShieldCheck className="h-3 w-3 sm:h-4 w-4" />
              Encrypted
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="order-2"
        >
          <Card className="overflow-hidden border-border/40 bg-white/75 shadow-xl sm:shadow-2xl backdrop-blur-3xl dark:bg-zinc-950/70 rounded-2xl md:rounded-[2.5rem] lg:rounded-3xl">
            <CardContent className="p-0">
              <div className="border-b border-border/40 bg-muted/30 p-2 sm:p-4">
                <div className="grid grid-cols-4 gap-1 rounded-2xl bg-zinc-200/60 p-1 dark:bg-zinc-900/50">
                  {engines.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      disabled={e.disabled}
                      onClick={() => onEngineChange(e.value)}
                      className={cn(
                        "relative rounded-xl px-1 py-2 text-[9px] sm:text-[11px] font-bold uppercase tracking-tight sm:tracking-[0.14em] transition-colors",
                        form.engine === e.value
                          ? "text-primary dark:text-white"
                          : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      )}
                    >
                      <span className="relative z-20">{e.label}</span>
                      {form.engine === e.value && (
                        <motion.div
                          layoutId="active-pill"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.55 }}
                          className="absolute inset-0 z-10 rounded-xl bg-white shadow-sm dark:bg-zinc-800"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6 lg:p-8">
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 px-1">
                    <Database className="h-3 w-3 sm:h-4 w-4 text-primary" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary/70">
                      Target: {form.engine} protocol
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Host Address</Label>
                      <div className="group relative">
                        <Server className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-primary", errors.host ? "text-red-500" : "text-muted-foreground")} />
                        <Input
                          ref={hostRef}
                          placeholder="localhost"
                          value={form.host}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, host: e.target.value }));
                            if (errors.host) setErrors((prev) => ({ ...prev, host: undefined }));
                          }}
                          className={getInputClassName("host", true)}
                        />
                      </div>
                      {errors.host && <p className="text-[10px] sm:text-xs text-red-500">{errors.host}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Port</Label>
                      <Input
                        ref={portRef}
                        type="number"
                        value={form.port}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, port: Number(e.target.value) }));
                          if (errors.port) setErrors((prev) => ({ ...prev, port: undefined }));
                        }}
                        className={getInputClassName("port")}
                      />
                      {errors.port && <p className="text-[10px] sm:text-xs text-red-500">{errors.port}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Credentials</Label>
                    <div className="space-y-3">
                      <div className="group relative">
                        <User className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within:text-primary", errors.username ? "text-red-500" : "text-muted-foreground")} />
                        <Input
                          ref={usernameRef}
                          placeholder="Username"
                          value={form.username}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, username: e.target.value }));
                            if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                          }}
                          className={getInputClassName("username", true)}
                        />
                      </div>
                      {errors.username && <p className="text-[10px] sm:text-xs text-red-500">{errors.username}</p>}

                      <div className="group relative">
                        <Lock className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within:text-primary", errors.password ? "text-red-500" : "text-muted-foreground")} />
                        <Input
                          ref={passwordRef}
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          value={form.password}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, password: e.target.value }));
                            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                          }}
                          className={getInputClassName("password", false, true)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && <p className="text-[10px] sm:text-xs text-red-500">{errors.password}</p>}

                      <div className="group relative">
                        <Database className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within:text-primary", errors.databaseName ? "text-red-500" : "text-muted-foreground")} />
                        <Input
                          ref={databaseNameRef}
                          placeholder="Database"
                          value={form.databaseName}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, databaseName: e.target.value }));
                            if (errors.databaseName) setErrors((prev) => ({ ...prev, databaseName: undefined }));
                          }}
                          className={getInputClassName("databaseName", true)}
                        />
                      </div>
                      {errors.databaseName && <p className="text-[10px] sm:text-xs text-red-500">{errors.databaseName}</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border/40 bg-gray-100/80 dark:bg-gray-900/80 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="save-conn" className="text-xs sm:text-sm font-semibold cursor-pointer">Save Connection</Label>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Store for future sessions.</p>
                    </div>
                    <Switch
                      id="save-conn"
                      checked={form.saveConnection}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, saveConnection: v }))}
                    />
                  </div>

                  <div className="h-px w-full bg-border/90" />

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="readonly" className="text-xs sm:text-sm font-semibold cursor-pointer">Read-Only Mode</Label>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Prevent accidental writes.</p>
                    </div>
                    <Switch
                      id="readonly"
                      checked={form.readOnly}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, readOnly: v }))}
                    />
                  </div>
                </div>

                <Button
                  onClick={connect}
                  disabled={isLoading}
                  className="group relative h-14 w-full overflow-hidden rounded-2xl bg-zinc-900 text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-black"
                >
                  <div className="relative z-10 flex items-center justify-center font-bold tracking-tight">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>
                        Launch Connection
                        <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <footer className="mt-12 lg:mt-16 flex items-center justify-center">
        <a href="https://servbase.net" target="_blank" className="group flex items-center gap-3 grayscale hover:grayscale-0 transition-all">
          <Image src="/branding/servbase.png" alt="Servbase" width={70} height={70} className="h-25 w-25 sm:h-14 sm:w-14" />
          <div className="border-l border-border/50 leading-tight text-left">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Powered By</p>
            <p className="text-sm sm:text-base font-semibold text-foreground">Servbase</p>
          </div>
        </a>
      </footer>
    </div>
  );
}