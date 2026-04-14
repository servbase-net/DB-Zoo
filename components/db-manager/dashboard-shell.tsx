"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Binary, Database, FileCode2, Info, LogOut, Orbit, Table2 } from "lucide-react";
import { DatabaseTreeSidebar } from "@/components/db-manager/database-tree-sidebar";
import { ThemeToggle } from "@/components/db-manager/theme-toggle";
import { useActiveSession } from "@/hooks/use-active-session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/connections", label: "Connections", icon: Database },
  { href: "/explorer", label: "Explorer", icon: Binary },
  { href: "/query", label: "SQL Editor", icon: FileCode2 },
  { href: "/tables", label: "Tables", icon: Table2 },
  { href: "/relational-diagram", label: "Relational Diagram", icon: Orbit },
  { href: "/server-info", label: "Server Info", icon: Info },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionId, clearSession, isReady } = useActiveSession();

  useEffect(() => {
    if (!isReady) return;

    if (!sessionId) {
      router.replace("/");
      return;
    }

    let mounted = true;
    const verifySession = async () => {
      const params = new URLSearchParams({
        sessionId,
        includeObjects: "false",
      });
      const res = await fetch(`/api/explorer?${params.toString()}`);
      const payload = await res.json();
      const message = String(payload?.error ?? "");
      const sessionInvalid =
        !res.ok &&
        (message.toLowerCase().includes("session not found") ||
          message.toLowerCase().includes("expired") ||
          message.toLowerCase().includes("sessionid is required"));
      if (mounted && sessionInvalid) {
        clearSession();
        router.replace("/");
      }
    };

    void verifySession();
    return () => {
      mounted = false;
    };
  }, [sessionId, clearSession, router, isReady]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
      <DatabaseTreeSidebar />
      <main className="flex h-screen min-h-0 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center px-4 py-3">
            <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Logout
              </Button>
              <ThemeToggle />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-muted",
                  pathname.startsWith(item.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </main>
    </div>
  );
}
