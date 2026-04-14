import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import {
  deleteRow,
  duplicateRow,
  getTableRows,
  insertRow,
  updateRow,
} from "@/lib/services/table-service";

type Params = {
  params: Promise<{
    connectionId: string;
    database: string;
    schema: string;
    table: string;
  }>;
};

export async function GET(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const qs = request.nextUrl.searchParams;
    const result = await getTableRows(params.connectionId, {
      database: params.database,
      schema: params.schema,
      table: params.table,
      options: {
        page: Number(qs.get("page") ?? 1),
        pageSize: Number(qs.get("pageSize") ?? 25),
        sortBy: qs.get("sortBy") ?? undefined,
        sortDirection: (qs.get("sortDirection") as "asc" | "desc" | null) ?? undefined,
        filter: qs.get("filter") ?? undefined,
      },
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const body = await request.json();
    if (body.mode === "duplicate") {
      await duplicateRow(params.connectionId, {
        database: params.database,
        schema: params.schema,
        table: params.table,
        row: body.row,
      });
      return ok({ duplicated: true });
    }
    await insertRow(params.connectionId, {
      database: params.database,
      schema: params.schema,
      table: params.table,
      row: body.row,
    });
    return ok({ inserted: true }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const body = await request.json();
    await updateRow(params.connectionId, {
      database: params.database,
      schema: params.schema,
      table: params.table,
      row: body.row,
      primaryKey: body.primaryKey,
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const body = await request.json();
    await deleteRow(params.connectionId, {
      database: params.database,
      schema: params.schema,
      table: params.table,
      primaryKey: body.primaryKey,
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
