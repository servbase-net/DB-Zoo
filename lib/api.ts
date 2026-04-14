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
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ ok: false, error: message }, { status });
}
