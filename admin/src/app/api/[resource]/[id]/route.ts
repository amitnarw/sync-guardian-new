import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { deleteRow, fetchOne, updateRow } from "@/lib/api/crud";
import { getResource } from "@/lib/resources";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { resource, id } = await ctx.params;
  try {
    const row = await fetchOne(resource, id);
    return NextResponse.json({ data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return jsonError(message, message.includes("not found") ? 404 : 500);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { resource, id } = await ctx.params;
  const cfg = getResource(resource);
  if (!cfg) return jsonError("Unknown resource", 404);
  if (!cfg.canEdit) return jsonError("This resource is read-only", 405);

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const row = await updateRow(resource, id, payload);
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Update failed", 400);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { resource, id } = await ctx.params;
  const cfg = getResource(resource);
  if (!cfg) return jsonError("Unknown resource", 404);
  if (!cfg.canDelete) return jsonError("Deleting is not allowed for this resource", 405);

  try {
    const row = await deleteRow(resource, id);
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Delete failed", 400);
  }
}
