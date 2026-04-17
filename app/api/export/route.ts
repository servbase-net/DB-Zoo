import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { importExportSchema } from "@/lib/validation/query";
import { exportTable } from "@/lib/services/table-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = importExportSchema.parse(body);
    const payload = await exportTable(parsed.sessionId, {
      database: parsed.database,
      schema: parsed.schema,
      table: parsed.table,
      format: parsed.format,
    });
    const ext = parsed.format === "csv" ? "csv" : "sql";

    return new NextResponse(payload.data, {
      headers: {
        "Content-Type": payload.mimeType,
        "Content-Disposition": `attachment; filename="${parsed.table}.${ext}"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}