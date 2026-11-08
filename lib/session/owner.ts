import { randomUUID } from "crypto";
import { cookies } from "next/headers";

export const OWNER_COOKIE = "servbase_owner";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Anonymous per-browser owner id. Saved connections are scoped to it. Call only from route handlers. */
export async function getOwnerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(OWNER_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return id;
}
