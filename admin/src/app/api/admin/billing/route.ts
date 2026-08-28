/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// supabase-js v2's query builders are deeply generic; we intentionally use
// loose typing on the server to avoid pulling table types into the admin app.
type LooseQuery = any;

const SearchUsers = z.object({
  action: z.literal("search_users"),
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(50).optional(),
});

const GetUserBilling = z.object({
  action: z.literal("get_user_billing"),
  user_id: z.string().uuid(),
});

const GiftTrial = z.object({
  action: z.literal("gift_trial"),
  user_id: z.string().uuid(),
  days: z.number().int().min(1).max(365),
  notes: z.string().trim().max(1000).optional(),
});

const GiftSubscription = z.object({
  action: z.literal("gift_subscription"),
  user_id: z.string().uuid(),
  plan_id: z.string().min(1).max(100),
  cycles: z.number().int().min(1).max(120).default(1),
  notes: z.string().trim().max(1000).optional(),
});

const RevokeTrial = z.object({
  action: z.literal("revoke_trial"),
  user_id: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
});

const RevokeGiftSubscription = z.object({
  action: z.literal("revoke_gift_subscription"),
  subscription_id: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
});

const BodySchema = z.discriminatedUnion("action", [
  SearchUsers,
  GetUserBilling,
  GiftTrial,
  GiftSubscription,
  RevokeTrial,
  RevokeGiftSubscription,
]);

function escapeIlike(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

function badRequest(message: string): NextResponse {
  return jsonError(message, 400);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload");
  }
  const body = parsed.data;

  const adminUserId = auth.user.id;

  try {
    switch (body.action) {
      case "search_users":
        return await handleSearchUsers(body.query, body.limit ?? 20);
      case "get_user_billing":
        return await handleGetUserBilling(body.user_id);
      case "gift_trial":
        return await handleGiftTrial(adminUserId, body.user_id, body.days, body.notes);
      case "gift_subscription":
        return await handleGiftSubscription(
          adminUserId,
          body.user_id,
          body.plan_id,
          body.cycles,
          body.notes,
        );
      case "revoke_trial":
        return await handleRevokeTrial(adminUserId, body.user_id, body.notes);
      case "revoke_gift_subscription":
        return await handleRevokeGiftSubscription(
          adminUserId,
          body.subscription_id,
          body.notes,
        );
      default:
        return badRequest("Unknown action");
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Action failed", 500);
  }
}

async function handleSearchUsers(
  query: string,
  limit: number,
): Promise<NextResponse> {
  const client = getServiceClient();
  const term = escapeIlike(query);
  if (!term) return NextResponse.json({ data: [] });

  // Match profiles by display_name OR email/phone from auth.users.
  // supabase-js auth.admin.listUsers is heavy; rely on a profiles join + auth scan.
  const { data: profiles, error: profileErr } = await (client
    .from("profiles")
    .select("id,display_name")
    .or(`display_name.ilike.%${term}%`)
    .limit(limit) as LooseQuery);
  if (profileErr) throw new Error(profileErr.message);

  // Also look up auth users by email/phone.
  const matchedIds = new Set<string>();
  const profileRows: Record<string, unknown>[] = profiles ?? [];
  for (const p of profileRows) matchedIds.add(String(p.id));

  // Auth admin search: listUsers with a small perPage and filter in-memory.
  const { data: authPage, error: authErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (authErr) throw new Error(authErr.message);
  const lower = term.toLowerCase();
  const authMatches: Record<string, unknown>[] = [];
  for (const u of authPage.users) {
    const email = (u.email ?? "").toLowerCase();
    const phone = (u.phone ?? "").toLowerCase();
    if (email.includes(lower) || phone.includes(lower)) {
      authMatches.push({
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        display_name: null as string | null,
      });
      matchedIds.add(u.id);
    }
  }

  // Enrich matched auth-only ids with profile data.
  const missingProfileIds = Array.from(matchedIds).filter(
    (id) => !profileRows.some((p) => p.id === id),
  );
  if (missingProfileIds.length > 0) {
    const { data: extra } = await (client
      .from("profiles")
      .select("id,display_name")
      .in("id", missingProfileIds) as LooseQuery);
    for (const p of (extra ?? []) as Record<string, unknown>[]) {
      profileRows.push(p);
    }
  }

  // Fetch billing snapshot for each matched user.
  const userIds = Array.from(matchedIds).slice(0, limit);
  const billingByUser = await loadBillingSnapshots(userIds);

  const authById = new Map<string, Record<string, unknown>>();
  for (const a of authMatches) authById.set(String(a.id), a);

  const results = userIds.map((id) => {
    const profile = profileRows.find((p) => String(p.id) === id);
    const auth = authById.get(id);
    return {
      id,
      email: auth?.email ?? null,
      phone: auth?.phone ?? null,
      display_name: (profile?.display_name as string | null) ?? null,
      billing: billingByUser.get(id) ?? emptyBilling(),
    };
  });

  // Also include auth-only matches (those without a profile row).
  for (const a of authMatches) {
    if (results.some((r) => r.id === a.id)) continue;
    const id = String(a.id);
    results.push({
      id,
      email: (a.email as string | null) ?? null,
      phone: (a.phone as string | null) ?? null,
      display_name: null,
      billing: billingByUser.get(id) ?? emptyBilling(),
    });
  }

  return NextResponse.json({ data: results.slice(0, limit) });
}

async function handleGetUserBilling(userId: string): Promise<NextResponse> {
  const map = await loadBillingSnapshots([userId]);
  return NextResponse.json({ data: map.get(userId) ?? emptyBilling() });
}

async function handleGiftTrial(
  adminUserId: string,
  userId: string,
  days: number,
  notes: string | undefined,
): Promise<NextResponse> {
  const client = getServiceClient();
  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 86_400_000);

  const { data: existing, error: existingErr } = await (client
    .from("user_trials")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle() as LooseQuery);
  if (existingErr) throw new Error(existingErr.message);

  if (existing?.id) {
    const { error: updErr } = await (client
      .from("user_trials")
      .update({
        status: "active",
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq("id", existing.id) as LooseQuery);
    if (updErr) throw new Error(updErr.message);
  } else {
    const { error: insErr } = await (client.from("user_trials").insert({
      user_id: userId,
      status: "active",
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
    }) as LooseQuery);
    if (insErr) throw new Error(insErr.message);
  }

  await logEvent({
    user_id: userId,
    subscription_id: null,
    event_type: "trial_gifted",
    payload: {
      admin_user_id: adminUserId,
      action: "gift_trial",
      days,
      notes: notes ?? null,
      ends_at: endsAt.toISOString(),
    },
  });

  const billing = (await loadBillingSnapshots([userId])).get(userId) ?? emptyBilling();
  return NextResponse.json({ data: billing });
}

async function handleGiftSubscription(
  adminUserId: string,
  userId: string,
  planId: string,
  cycles: number,
  notes: string | undefined,
): Promise<NextResponse> {
  const client = getServiceClient();

  const { data: plan, error: planErr } = await (client
    .from("plans")
    .select("id,frequency,amount_paise")
    .eq("id", planId)
    .maybeSingle() as LooseQuery);
  if (planErr) throw new Error(planErr.message);
  if (!plan) throw new Error("Plan not found");

  // Refuse if user already has an active/pending/paused subscription of any source.
  const { data: active } = await (client
    .from("subscriptions")
    .select("id,source,status")
    .eq("user_id", userId)
    .in("status", ["pending", "active", "paused"])
    .maybeSingle() as LooseQuery);
  if (active) {
    throw new Error(
      `User already has an active subscription (source=${active.source}). Revoke it before gifting a new one.`,
    );
  }

  const cycleMs =
    plan.frequency === "yearly" ? 365 * 86_400_000 : 30 * 86_400_000;
  const start = new Date();
  const end = new Date(start.getTime() + cycles * cycleMs);

  const { data: sub, error: subErr } = await (client
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_id: plan.id,
      status: "active",
      source: "gift",
      gifted_by: adminUserId,
      gifted_at: start.toISOString(),
      notes: notes ?? null,
      current_cycle_start: start.toISOString(),
      current_cycle_end: end.toISOString(),
      next_charge_at: end.toISOString(),
      last_charge_amount_paise: 0,
    })
    .select()
    .single() as LooseQuery);
  if (subErr) throw new Error(subErr.message);

  await logEvent({
    user_id: userId,
    subscription_id: sub.id,
    event_type: "subscription_gifted",
    payload: {
      admin_user_id: adminUserId,
      action: "gift_subscription",
      plan_id: plan.id,
      cycles,
      frequency: plan.frequency,
      ends_at: end.toISOString(),
      notes: notes ?? null,
    },
  });

  const billing = (await loadBillingSnapshots([userId])).get(userId) ?? emptyBilling();
  return NextResponse.json({ data: billing });
}

async function handleRevokeTrial(
  adminUserId: string,
  userId: string,
  notes: string | undefined,
): Promise<NextResponse> {
  const client = getServiceClient();
  const { data: trial, error: tErr } = await (client
    .from("user_trials")
    .select("id,status")
    .eq("user_id", userId)
    .maybeSingle() as LooseQuery);
  if (tErr) throw new Error(tErr.message);
  if (!trial) throw new Error("User has no trial to revoke");

  const { error: updErr } = await (client
    .from("user_trials")
    .update({ status: "expired", ends_at: new Date().toISOString() })
    .eq("id", trial.id) as LooseQuery);
  if (updErr) throw new Error(updErr.message);

  await logEvent({
    user_id: userId,
    subscription_id: null,
    event_type: "trial_revoked",
    payload: {
      admin_user_id: adminUserId,
      action: "revoke_trial",
      previous_status: trial.status,
      notes: notes ?? null,
    },
  });

  const billing = (await loadBillingSnapshots([userId])).get(userId) ?? emptyBilling();
  return NextResponse.json({ data: billing });
}

async function handleRevokeGiftSubscription(
  adminUserId: string,
  subscriptionId: string,
  notes: string | undefined,
): Promise<NextResponse> {
  const client = getServiceClient();
  const { data: sub, error: sErr } = await (client
    .from("subscriptions")
    .select("id,user_id,status,source")
    .eq("id", subscriptionId)
    .maybeSingle() as LooseQuery);
  if (sErr) throw new Error(sErr.message);
  if (!sub) throw new Error("Subscription not found");
  if (sub.source !== "gift") {
    throw new Error("Only gifted subscriptions can be revoked from the admin panel");
  }

  const { error: updErr } = await (client
    .from("subscriptions")
    .update({ status: "cancelled", error_message: null })
    .eq("id", subscriptionId) as LooseQuery);
  if (updErr) throw new Error(updErr.message);

  await logEvent({
    user_id: sub.user_id,
    subscription_id: subscriptionId,
    event_type: "subscription_revoked",
    payload: {
      admin_user_id: adminUserId,
      action: "revoke_gift_subscription",
      previous_status: sub.status,
      notes: notes ?? null,
    },
  });

  const billing =
    (await loadBillingSnapshots([sub.user_id])).get(sub.user_id) ?? emptyBilling();
  return NextResponse.json({ data: billing });
}

interface BillingSnapshot {
  has_access: boolean;
  reason: "trial" | "subscription" | "none";
  trial: {
    status: string;
    started_at: string | null;
    ends_at: string | null;
    days_remaining: number;
  } | null;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
    source: string;
    current_cycle_start: string | null;
    current_cycle_end: string | null;
    next_charge_at: string | null;
    gifted_by: string | null;
    gifted_at: string | null;
    notes: string | null;
  } | null;
  children: { pair_id: string; child_user_id: string; name: string }[];
}

function emptyBilling(): BillingSnapshot {
  return {
    has_access: false,
    reason: "none",
    trial: null,
    subscription: null,
    children: [],
  };
}

async function loadBillingSnapshots(
  userIds: string[],
): Promise<Map<string, BillingSnapshot>> {
  const out = new Map<string, BillingSnapshot>();
  if (userIds.length === 0) return out;

  const client = getServiceClient();
  const [trialsRes, subsRes, pairsRes, profilesRes] = await Promise.all([
    client
      .from("user_trials")
      .select("user_id,status,started_at,ends_at")
      .in("user_id", userIds),
    client
      .from("subscriptions")
      .select(
        "id,user_id,plan_id,status,source,current_cycle_start,current_cycle_end,next_charge_at,gifted_by,gifted_at,notes",
      )
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    client
      .from("pairs")
      .select("id,parent_user_id,child_user_id")
      .in("parent_user_id", userIds),
    client.from("profiles").select("id,display_name"),
  ]);

  if (trialsRes.error) throw new Error(trialsRes.error.message);
  if (subsRes.error) throw new Error(subsRes.error.message);
  if (pairsRes.error) throw new Error(pairsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const nameByUser = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    if (p.display_name) nameByUser.set(String(p.id), String(p.display_name));
  }

  const now = Date.now();
  for (const userId of userIds) {
    const trial = (trialsRes.data ?? []).find((t) => t.user_id === userId) ?? null;
    const subs = (subsRes.data ?? []).filter((s) => s.user_id === userId);
    const liveSub =
      subs.find((s) => s.status === "active" || s.status === "paused") ?? null;

    let reason: "trial" | "subscription" | "none" = "none";
    let hasAccess = false;
    if (liveSub) {
      hasAccess = true;
      reason = "subscription";
    } else if (
      trial &&
      trial.status === "active" &&
      trial.ends_at &&
      new Date(trial.ends_at).getTime() > now
    ) {
      hasAccess = true;
      reason = "trial";
    }

    const childPairs = (pairsRes.data ?? []).filter(
      (p) => p.parent_user_id === userId,
    );
    const children = childPairs.map((p) => ({
      pair_id: p.id,
      child_user_id: p.child_user_id,
      name: nameByUser.get(p.child_user_id) ?? p.child_user_id.slice(0, 8) + "…",
    }));

    out.set(userId, {
      has_access: hasAccess,
      reason,
      trial: trial
        ? {
            status: trial.status,
            started_at: trial.started_at,
            ends_at: trial.ends_at,
            days_remaining:
              trial.ends_at && new Date(trial.ends_at).getTime() > now
                ? Math.max(
                    0,
                    Math.ceil(
                      (new Date(trial.ends_at).getTime() - now) / 86_400_000,
                    ),
                  )
                : 0,
          }
        : null,
      subscription: liveSub
        ? {
            id: liveSub.id,
            plan_id: liveSub.plan_id,
            status: liveSub.status,
            source: liveSub.source ?? "phonepe",
            current_cycle_start: liveSub.current_cycle_start,
            current_cycle_end: liveSub.current_cycle_end,
            next_charge_at: liveSub.next_charge_at,
            gifted_by: liveSub.gifted_by,
            gifted_at: liveSub.gifted_at,
            notes: liveSub.notes,
          }
        : null,
      children,
    });
  }

  return out;
}

async function logEvent(args: {
  user_id: string;
  subscription_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const client = getServiceClient();
  const { error } = await (client
    .from("subscription_events")
    .insert({
      user_id: args.user_id,
      subscription_id: args.subscription_id,
      event_type: args.event_type,
      payload: args.payload,
    }) as LooseQuery);
  if (error) throw new Error(error.message);
}