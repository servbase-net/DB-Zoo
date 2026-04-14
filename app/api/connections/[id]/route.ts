import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { deleteSavedConnection, updateSavedConnection } from "@/lib/services/connection-service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await updateSavedConnection(id, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteSavedConnection(id);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
