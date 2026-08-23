import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getServerUserClient, isAdminEmail } from "@/lib/supabase/server";

/**
 * Verifies the caller has a valid Supabase session AND an allowlisted admin email.
 * Returns the user or null; handlers respond 401/403 accordingly.
 */
export async function requireAdmin(): Promise<{ user: User } | { error: NextResponse }> {
  const client = await getServerUserClient();
  if (!client) {
    return {
      error: NextResponse.json(
        { message: "Server auth is not configured (missing Supabase env vars)" },
        { status: 500 },
      ),
    };
  }
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminEmail(data.user.email)) {
    return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }
  return { user: data.user };
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ message }, { status });
}
