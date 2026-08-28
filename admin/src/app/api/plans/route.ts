import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const client = getServiceClient();
  const { data, error } = await client
    .from("plans")
    .select("id,name,tier,frequency,amount_paise,active")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data ?? [] });
}