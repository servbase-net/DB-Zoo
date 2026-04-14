"use client";

import { useEffect, useState } from "react";
import { useActiveSession } from "@/hooks/use-active-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ServerInfo = {
  engine: string;
  version: string;
  uptime?: string;
  charset?: string;
  collation?: string;
  capabilities: string[];
};

export function ServerInfoPanel() {
  const { sessionId } = useActiveSession();
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      const res = await fetch("/api/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        setError(payload.error ?? "Unable to load server metadata");
        return;
      }
      setInfo(payload.data);
    }
    load();
  }, [sessionId]);

  if (!sessionId) {
    return <p className="text-sm text-muted-foreground">No active session.</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!info) {
    return <p className="text-sm text-muted-foreground">Loading metadata...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server / Connection Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Engine</p>
            <p className="font-medium">{info.engine}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="font-medium">{info.version}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Charset</p>
            <p className="font-medium">{info.charset ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collation</p>
            <p className="font-medium">{info.collation ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Uptime</p>
            <p className="font-medium">{info.uptime ?? "N/A (placeholder model)"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {info.capabilities.map((capability) => (
            <Badge key={capability} variant="outline">
              {capability}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
