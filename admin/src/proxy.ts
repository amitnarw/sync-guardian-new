import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/not-allowed", "/auth/callback"];

function isAdminEmail(email?: string | null): boolean {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!email || allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // Without env config we cannot authenticate: render public pages (so the
  // operator sees setup guidance), but block everything else.
  if (!url || !anonKey) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ message: "Auth is not configured" }, { status: 500 });
    }
    if (!isPublic) {
      return NextResponse.redirect(new URL("/login?error=config", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !isPublic) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && !isAdminEmail(user.email)) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (!isPublic) {
      return NextResponse.redirect(new URL("/not-allowed", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
