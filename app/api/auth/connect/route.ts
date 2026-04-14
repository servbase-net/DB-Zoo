import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { connectionInputSchema } from "@/lib/validation/connection";
import { connectAndCreateSession, saveConnection } from "@/lib/services/connection-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = connectionInputSchema.parse(body);
    const sessionId = await connectAndCreateSession(parsed);

    if (body.saveConnection && body.name) {
      await saveConnection({
        ...parsed,
        name: String(body.name),
        tags: Array.isArray(body.tags) ? body.tags : [],
      });
    }
    return ok({ sessionId }, 201);
  } catch (error) {
    return fail(error);
  }
}
