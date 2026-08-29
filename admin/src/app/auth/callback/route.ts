import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  if (code) {
    // Build the redirect response FIRST so we can attach session cookies
    // directly to it. The previous implementation wrote cookies to a
    // NextResponse.next() intermediate and copied them onto the final
    // redirect, which is brittle in Next.js 16 where cookie jars may
    // not be mutable on next() responses.
    const redirectTarget = NextResponse.redirect(
      new URL(next.startsWith("/") ? next : "/", origin),
    );

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            redirectTarget.cookies.set(name, value, options);
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTarget;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
