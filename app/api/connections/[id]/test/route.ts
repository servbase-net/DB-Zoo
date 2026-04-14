import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { buildConnectionInputFromSaved, testConnection } from "@/lib/services/connection-service";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await buildConnectionInputFromSaved(id);
    const result = await testConnection(input);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
