import { headers } from "next/headers";
import type { AppRole } from "@/lib/types/auth";

export async function getRequestRole(): Promise<AppRole> {
  const headerRole = (await headers()).get("x-servbase-role");
  if (headerRole === "admin" || headerRole === "operator" || headerRole === "read_only") {
    return headerRole;
  }
  return "operator";
}
