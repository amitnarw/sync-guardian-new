/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { decryptNotification, DecryptionError } from "@/lib/notification-crypto";

export const dynamic = "force-dynamic";

async function countOf(
  table: string,
  extra?: (q: any) => any,
): Promise<number> {
  const client = getServiceClient();
  let q: any = client.from(table).select("*", { count: "exact", head: true });
  if (extra) q = extra(q);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const client = getServiceClient();
    const since14d = new Date(Date.now() - 13 * 24 * 3600 * 1000);
    since14d.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDevices,
      totalPairs,
      activePairs,
      revokedPairs,
      pendingPairs,
      totalNotifications,
      notifications14d,
      subsActive,
      subsPending,
      subsCancelled,
      subsExpired,
      subsGiftedActive,
      trialsActive,
      trialsExpiringSoon,
      tokensActive,
      plansActive,
      recentRows,
    ] = await Promise.all([
      countOf("profiles"),
      countOf("devices"),
      countOf("pairs"),
      countOf("pairs", (q) => q.eq("status", "active")),
      countOf("pairs", (q) => q.eq("status", "revoked")),
      countOf("pairs", (q) => q.eq("status", "pending")),
      countOf("mirrored_notifications"),
      client
        .from("mirrored_notifications")
        .select("ingested_at")
        .gte("ingested_at", since14d.toISOString())
        .order("ingested_at", { ascending: true })
        .limit(50000)
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          return data ?? [];
        }),
      countOf("subscriptions", (q) => q.eq("status", "active")),
      countOf("subscriptions", (q) => q.eq("status", "pending")),
      countOf("subscriptions", (q) => q.in("status", ["cancelled", "revoked"])),
      countOf("subscriptions", (q) => q.eq("status", "expired")),
      countOf("subscriptions", (q) => q.eq("source", "gift").in("status", ["active", "paused"])),
      countOf("admin_parent_trials", (q) => q.eq("status", "active")),
      countOf("admin_parent_trials", (q) =>
        q.eq("status", "active").lte("ends_at", new Date(Date.now() + 3 * 86_400_000).toISOString()),
      ),
      countOf("pairing_tokens", (q) => q.is("consumed_at", null)),
      countOf("plans", (q) => q.eq("active", true)),
      client
        .from("mirrored_notifications")
        .select(
          "id,parent_user_id,child_user_id,notification_title,notification_body,source_package,source_app_name,notification_posted_at",
        )
        .order("notification_posted_at", { ascending: false })
        .limit(8)
        .then(async ({ data, error }) => {
          if (error) throw new Error(error.message);
          const rows = [];
          for (const row of data ?? []) {
            const rec = row as Record<string, unknown>;
            const pUserId = rec.parent_user_id;
            const cUserId = rec.child_user_id;
            if (typeof pUserId === "string" && typeof cUserId === "string") {
              try {
                rows.push(await decryptNotification(rec, pUserId, cUserId));
              } catch (err) {
                if (err instanceof DecryptionError) {
                  // Skip the undecryptable row rather than leak the raw
                  // "nv1:" blob into the dashboard.
                  continue;
                }
                throw err;
              }
            } else {
              rows.push(rec);
            }
          }
          return rows;
        }),
    ]);

    // Bucket notifications by day for the last 14 days
    const series: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      series.push({ date: d.toISOString().slice(0, 10), count: 0 });
    }
    const index = new Map(series.map((s) => [s.date, s]));
    for (const row of notifications14d) {
      const ts = (row as { ingested_at?: string }).ingested_at;
      if (!ts) continue;
      const bucket = index.get(ts.slice(0, 10));
      if (bucket) bucket.count += 1;
    }

    return NextResponse.json({
      data: {
        stats: {
          totalUsers,
          totalDevices,
          pairs: { total: totalPairs, active: activePairs, revoked: revokedPairs, pending: pendingPairs },
          subscriptions: { active: subsActive, pending: subsPending, cancelled: subsCancelled, expired: subsExpired },
          totalNotifications,
          trialsActive,
          trialsExpiringSoon,
          giftedActive: subsGiftedActive,
          tokensActive,
          plansActive,
        },
        notificationSeries: series,
        recentNotifications: recentRows,
      },
    });
  } catch (err) {
    // Server-side log so the real error is preserved for ops debugging.
    // The client-facing message is intentionally generic so internal Supabase
    // errors (column names, constraint names, SQL hints) never leak to admins.
    console.error('dashboard route failed', err);
    return NextResponse.json(
      { message: 'Dashboard failed. Please try again or contact support.' },
      { status: 500 },
    );
  }
}
