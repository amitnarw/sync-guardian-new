import { supabase } from '@/lib/supabase';

export type PlanFrequency = 'monthly' | 'yearly';

export interface Plan {
  id: string;
  tier: 'tier_a' | 'tier_b';
  name: string;
  description: string;
  frequency: PlanFrequency;
  amount_paise: number;
  max_amount_paise: number;
  discount_label: string | null;
  active: boolean;
  sort_order: number;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'revoked';
  merchant_order_id: string | null;
  merchant_subscription_id: string | null;
  phonepe_order_id: string | null;
  last_charge_amount_paise: number | null;
  current_cycle_start: string | null;
  current_cycle_end: string | null;
  next_charge_at: string | null;
  created_at: string;
}

export interface SubscriptionStateResponse {
  hasAccess: boolean;
  reason: 'trial' | 'subscription' | 'none';
  /** True when the caller is a child device; access mirrors the paired parent. */
  is_child?: boolean;
  /** Parent user who manages this child's access (children only). */
  managed_by_parent_user_id?: string | null;
  trial: {
    status: string;
    started_at: string | null;
    ends_at: string | null;
    days_remaining: number;
  } | null;
  subscription: SubscriptionRow | null;
}

export interface CreateAutopayResult {
  subscriptionId: string;
  merchantId: string;
  orderId: string;
  token: string;
  environment: 'SANDBOX' | 'PRODUCTION';
}

async function readError(error: unknown): Promise<string> {
  const ctx = (error as any)?.context;
  if (ctx) {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error;
    } catch {}
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function getMySubscription(): Promise<SubscriptionStateResponse> {
  const { data, error } = await supabase.functions.invoke('get-my-subscription');
  if (error) {
    throw new Error(await readError(error));
  }
  return (data as { data: SubscriptionStateResponse }).data;
}

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.functions.invoke('list-plans');
  if (error) {
    throw new Error(await readError(error));
  }
  return (data as { data: Plan[] }).data ?? [];
}

export async function createAutopaySubscription(planId: string): Promise<CreateAutopayResult> {
  const { data, error } = await supabase.functions.invoke('create-autopay-subscription', {
    body: { plan_id: planId },
  });
  if (error) {
    throw new Error(await readError(error));
  }
  return (data as { data: CreateAutopayResult }).data;
}

export async function cancelSubscription(): Promise<{ status: string; remoteCancelled: boolean }> {
  const { data, error } = await supabase.functions.invoke('cancel-subscription');
  if (error) {
    throw new Error(await readError(error));
  }
  return (data as { data: { status: string; remoteCancelled: boolean } }).data;
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
