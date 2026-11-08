import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: "Validation error", issues: error.flatten() },
      { status: 422 },
    );
  }
  let message = error instanceof Error ? error.message : "Unknown error";
  // node-pg errors carry the useful part (e.g. which key already exists) in `detail`.
  const detail = (error as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) message += ` (${detail})`;
  return NextResponse.json({ ok: false, error: message }, { status });
}
