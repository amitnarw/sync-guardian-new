"use client";

import { useSyncExternalStore } from "react";
import { ShieldCheck } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function Splash() {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ShieldCheck className="size-5 animate-pulse" />
        <span className="text-sm">Loading admin panel…</span>
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};

/**
 * Client-only rendering gate: Refine + TanStack Query must never execute
 * during SSR/prerender (no env vars / cookies available at build time).
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();

  if (!mounted) return <Splash />;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex-1 space-y-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
