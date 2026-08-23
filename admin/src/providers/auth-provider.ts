import { createBrowserClient } from "@supabase/ssr";
import type { AuthProvider } from "@refinedev/core";

let client: ReturnType<typeof createBrowserClient> | null = null;

function supabase() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

export const authProvider: AuthProvider = {
  login: async () => {
    try {
      const { error } = await supabase().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return { success: false, error: { message: error.message, statusCode: 400 } };
      // Browser redirects to Google; nothing else to do.
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { message: err instanceof Error ? err.message : "Login failed", statusCode: 500 },
      };
    }
  },

  logout: async () => {
    await supabase().auth.signOut();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    try {
      // Local session read — no network. Server-side verification still
      // happens on every request (proxy.ts + API route handlers), which is
      // the real gatekeeper; this only drives UI state.
      const { data } = await supabase().auth.getSession();
      if (!data.session?.user) {
        return { authenticated: false, logout: true, redirectTo: "/login" };
      }
      return { authenticated: true };
    } catch {
      return { authenticated: false, logout: true, redirectTo: "/login" };
    }
  },

  onError: async (error) => {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 401) {
      return { logout: true, redirectTo: "/login" };
    }
    return {};
  },

  getIdentity: async () => {
    // Local session read — avoids a /auth/v1/user round-trip on every mount.
    const { data } = await supabase().auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name:
        (user.user_metadata as Record<string, string> | undefined)?.full_name ??
        user.email,
      avatar_url:
        (user.user_metadata as Record<string, string> | undefined)?.avatar_url,
    };
  },
};
