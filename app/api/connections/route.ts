import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import {
  buildConnectionInputFromSaved,
  connectAndCreateSession,
  listSavedConnections,
  saveConnection,
} from "@/lib/services/connection-service";
import { saveConnectionSchema } from "@/lib/validation/connection";

export async function GET() {
  try {
    const connections = await listSavedConnections();
    return ok(connections);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = saveConnectionSchema.parse(body);
    const result = await saveConnection(parsed);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const savedId = String(body.savedConnectionId);
    const input = await buildConnectionInputFromSaved(savedId);
    const sessionId = await connectAndCreateSession(input, body.label);
    return ok({ sessionId });
  } catch (error) {
    return fail(error);
  }
}
