import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { fetchList, insertRow } from "@/lib/api/crud";
import type { CrudFilter } from "@refinedev/core";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { resource } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  const start = Number(sp.get("start") ?? 0);
  const end = Number(sp.get("end") ?? 24);
  let filters: CrudFilter[] | undefined;
  const rawFilters = sp.get("filters");
  if (rawFilters) {
    try {
      filters = JSON.parse(rawFilters) as CrudFilter[];
    } catch {
      return jsonError("Invalid filters parameter", 400);
    }
  }

  try {
    const result = await fetchList(resource, {
      start,
      end,
      sortField: sp.get("sortField") ?? undefined,
      sortOrder: sp.get("sortOrder") ?? undefined,
      filters,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "List failed", 500);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { resource } = await ctx.params;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const row = await insertRow(resource, payload);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Create failed", 400);
  }
}
