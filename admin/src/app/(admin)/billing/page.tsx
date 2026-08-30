"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TONE_CLASSES, formatDate, shortId, toneForValue } from "@/lib/format";

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

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  billing: BillingSnapshot;
}

interface PlanRow {
  id: string;
  name: string;
  tier: string;
  frequency: "monthly" | "yearly";
  amount_paise: number;
  active: boolean;
}

const TRIAL_PRESETS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "365 days", value: 365 },
];

const CYCLE_PRESETS = [
  { label: "1 cycle", value: 1 },
  { label: "3 cycles", value: 3 },
  { label: "6 cycles", value: 6 },
  { label: "12 cycles", value: 12 },
];

export default function BillingControlPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);

  // Dialog state
  const [giftTrialOpen, setGiftTrialOpen] = useState(false);
  const [giftSubOpen, setGiftSubOpen] = useState(false);
  const [revokeTrialOpen, setRevokeTrialOpen] = useState(false);
  const [revokeSubOpen, setRevokeSubOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "search_users", query: term, limit: 20 }),
      });
      const json = (await res.json()) as { data?: UserRow[]; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Search failed");
      setResults(json.data ?? []);
    } catch (err) {
      setResults([]);
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => runSearch(searchTerm), 350);
    return () => clearTimeout(handle);
  }, [searchTerm, runSearch]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plans", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { data?: PlanRow[] }) => {
        if (!cancelled) setPlans(j.data ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const openUser = useCallback(async (user: UserRow) => {
    setSelectedUser(user);
    setLoadingBilling(true);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "get_user_billing", user_id: user.id }),
      });
      const json = (await res.json()) as { data?: BillingSnapshot; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed to load billing");
      setSelectedUser({ ...user, billing: json.data ?? user.billing });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoadingBilling(false);
    }
  }, []);

  const onAction = useCallback(
    async (
      payload: Record<string, unknown>,
      successMessage: string,
      resetDialog: () => void,
    ) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { data?: BillingSnapshot; message?: string };
        if (!res.ok) throw new Error(json.message ?? "Action failed");
        if (json.data && selectedUser) {
          setSelectedUser({ ...selectedUser, billing: json.data });
        }
        toast.success(successMessage);
        resetDialog();
        await runSearch(searchTerm);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [runSearch, router, searchTerm, selectedUser],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing Control</h1>
        <p className="text-sm text-muted-foreground">
          Look up any user, then gift or revoke trial periods and subscriptions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Find a user</CardTitle>
            <CardDescription>Search by email, phone, or display name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="jane@example.com"
                className="pl-8 pr-8"
                autoFocus
              />
              {searchTerm ? (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {searchError ? (
              <Alert variant="destructive">
                <AlertTitle>Search failed</AlertTitle>
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              {searching ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))
              ) : searchTerm.trim() === "" ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Start typing to search.
                </p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No users matched.
                </p>
              ) : (
                results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openUser(u)}
                    className={`w-full rounded-md border p-3 text-left transition hover:bg-accent ${
                      selectedUser?.id === u.id ? "border-primary bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {u.display_name ?? u.email ?? shortId(u.id)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {u.email ?? u.phone ?? shortId(u.id)}
                        </p>
                      </div>
                      <AccessBadge billing={u.billing} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selectedUser ? (
            <EmptyState />
          ) : (
            <UserDetail
              user={selectedUser}
              loading={loadingBilling}
              plans={plans}
              onGiftTrial={() => setGiftTrialOpen(true)}
              onGiftSubscription={() => setGiftSubOpen(true)}
              onRevokeTrial={() => setRevokeTrialOpen(true)}
              onRevokeSubscription={() => setRevokeSubOpen(true)}
            />
          )}
        </div>
      </div>

      <GiftTrialDialog
        open={giftTrialOpen}
        onOpenChange={setGiftTrialOpen}
        user={selectedUser}
        busy={busy}
        onSubmit={(days, notes) =>
          onAction(
            { action: "gift_trial", user_id: selectedUser!.id, days, notes },
            `Trial granted (${days} days)`,
            () => setGiftTrialOpen(false),
          )
        }
      />

      <GiftSubscriptionDialog
        open={giftSubOpen}
        onOpenChange={setGiftSubOpen}
        user={selectedUser}
        busy={busy}
        plans={plans}
        onSubmit={(planId, cycles, notes) =>
          onAction(
            { action: "gift_subscription", user_id: selectedUser!.id, plan_id: planId, cycles, notes },
            "Subscription granted",
            () => setGiftSubOpen(false),
          )
        }
      />

      <RevokeTrialDialog
        open={revokeTrialOpen}
        onOpenChange={setRevokeTrialOpen}
        busy={busy}
        onSubmit={(notes) =>
          onAction(
            { action: "revoke_trial", user_id: selectedUser!.id, notes },
            "Trial revoked",
            () => setRevokeTrialOpen(false),
          )
        }
      />

      <RevokeSubscriptionDialog
        open={revokeSubOpen}
        onOpenChange={setRevokeSubOpen}
        busy={busy}
        onSubmit={(notes) =>
          onAction(
            {
              action: "revoke_gift_subscription",
              subscription_id: selectedUser!.billing.subscription!.id,
              notes,
            },
            "Subscription revoked",
            () => setRevokeSubOpen(false),
          )
        }
      />
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">
        Select a user from the list to view their access, gift a trial, or grant a subscription.
      </CardContent>
    </Card>
  );
}

function AccessBadge({ billing }: { billing: BillingSnapshot }) {
  if (billing.reason === "subscription") {
    return <Badge className={TONE_CLASSES.success}>Subscription</Badge>;
  }
  if (billing.reason === "trial") {
    return <Badge className={TONE_CLASSES.info}>Trial</Badge>;
  }
  return <Badge className={TONE_CLASSES.neutral}>No access</Badge>;
}

function UserDetail({
  user,
  loading,
  plans,
  onGiftTrial,
  onGiftSubscription,
  onRevokeTrial,
  onRevokeSubscription,
}: {
  user: UserRow;
  loading: boolean;
  plans: PlanRow[];
  onGiftTrial: () => void;
  onGiftSubscription: () => void;
  onRevokeTrial: () => void;
  onRevokeSubscription: () => void;
}) {
  const { billing } = user;
  const plan = useMemo(
    () => plans.find((p) => p.id === billing.subscription?.plan_id) ?? null,
    [plans, billing.subscription?.plan_id],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{user.display_name ?? user.email ?? user.id}</CardTitle>
        <CardDescription className="break-all">
          {user.email && <span>{user.email}</span>}
          {user.email && user.phone ? " · " : null}
          {user.phone && <span>{user.phone}</span>}
          <span className="mt-1 block font-mono text-xs">{user.id}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading billing…
          </div>
        ) : (
          <>
            <SectionRow label="Access">
              <AccessBadge billing={billing} />
            </SectionRow>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Trial</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={onGiftTrial}>
                    Gift / extend trial
                  </Button>
                  {billing.trial ? (
                    <Button size="sm" variant="outline" onClick={onRevokeTrial}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
              {billing.trial ? (
                <div className="space-y-1 text-sm">
                  <Row k="Status" v={<Badge className={TONE_CLASSES[toneForValue(billing.trial.status)]}>{billing.trial.status}</Badge>} />
                  <Row k="Started" v={formatDate(billing.trial.started_at)} />
                  <Row k="Ends" v={formatDate(billing.trial.ends_at)} />
                  <Row k="Days remaining" v={`${billing.trial.days_remaining}`} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No trial row.</p>
              )}
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Subscription</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={onGiftSubscription}>
                    Gift subscription
                  </Button>
                  {billing.subscription && billing.subscription.source === "gift" ? (
                    <Button size="sm" variant="outline" onClick={onRevokeSubscription}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
              {billing.subscription ? (
                <div className="space-y-1 text-sm">
                  <Row k="Status" v={<Badge className={TONE_CLASSES[toneForValue(billing.subscription.status)]}>{billing.subscription.status}</Badge>} />
                  <Row k="Source" v={<Badge variant="outline">{billing.subscription.source}</Badge>} />
                  <Row k="Plan" v={`${plan ? `${plan.name} (${plan.tier})` : billing.subscription.plan_id}`} />
                  <Row k="Cycle start" v={formatDate(billing.subscription.current_cycle_start)} />
                  <Row k="Cycle end" v={formatDate(billing.subscription.current_cycle_end)} />
                  <Row k="Next charge" v={formatDate(billing.subscription.next_charge_at)} />
                  {billing.subscription.source === "gift" ? (
                    <>
                      <Row k="Granted by" v={billing.subscription.gifted_by ? shortId(billing.subscription.gifted_by) : ", "} />
                      <Row k="Granted at" v={formatDate(billing.subscription.gifted_at)} />
                      {billing.subscription.notes ? (
                        <Row k="Notes" v={<span className="whitespace-pre-wrap">{billing.subscription.notes}</span>} />
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No live subscription.</p>
              )}
            </div>

            {billing.children.length > 0 ? (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 text-sm font-medium">Paired children</h3>
                  <div className="flex flex-wrap gap-2">
                    {billing.children.map((c) => (
                      <Badge key={c.pair_id} variant="outline">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SectionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

function GiftTrialDialog({
  open,
  onOpenChange,
  user,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  busy: boolean;
  onSubmit: (days: number, notes: string) => void;
}) {
  const [preset, setPreset] = useState<string>("7");
  const [customDays, setCustomDays] = useState("");
  const [notes, setNotes] = useState("");

  const days = preset === "custom" ? Number(customDays) : Number(preset);
  const valid = Number.isFinite(days) && days > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gift trial</DialogTitle>
          <DialogDescription>
            Set the user&apos;s trial to {valid ? `${days} day(s)` : "a custom number of days"}, starting now. This
            overwrites any existing trial end date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIAL_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" ? (
            <div className="space-y-1.5">
              <Label htmlFor="custom-days">Custom days</Label>
              <Input
                id="custom-days"
                type="number"
                min={1}
                max={365}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="e.g. 21"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason, ticket id, etc."
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Acting on <span className="font-mono">{user?.email ?? user?.id ?? ", "}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(days, notes)} disabled={!valid || busy}>
            {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Gift trial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GiftSubscriptionDialog({
  open,
  onOpenChange,
  user,
  busy,
  plans,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  busy: boolean;
  plans: PlanRow[];
  onSubmit: (planId: string, cycles: number, notes: string) => void;
}) {
  const [planId, setPlanId] = useState<string>("");
  const [cyclesPreset, setCyclesPreset] = useState<string>("1");
  const [customCycles, setCustomCycles] = useState("");
  const [notes, setNotes] = useState("");

  const cycles = cyclesPreset === "custom" ? Number(customCycles) : Number(cyclesPreset);
  const valid = planId !== "" && Number.isFinite(cycles) && cycles > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gift subscription</DialogTitle>
          <DialogDescription>
            Create a complimentary subscription for this user. The cycle length is determined by the plan&apos;s frequency
            (monthly or yearly) and the number of cycles you choose.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan…" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.active}>
                    {p.name} · {p.tier} · {p.frequency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cycles</Label>
            <Select value={cyclesPreset} onValueChange={setCyclesPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLE_PRESETS.map((c) => (
                  <SelectItem key={c.value} value={String(c.value)}>
                    {c.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {cyclesPreset === "custom" ? (
            <div className="space-y-1.5">
              <Label htmlFor="custom-cycles">Custom cycles</Label>
              <Input
                id="custom-cycles"
                type="number"
                min={1}
                max={120}
                value={customCycles}
                onChange={(e) => setCustomCycles(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="sub-notes">Notes (optional)</Label>
            <Textarea
              id="sub-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason, ticket id, etc."
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Acting on <span className="font-mono">{user?.email ?? user?.id ?? ", "}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(planId, cycles, notes)} disabled={!valid || busy}>
            {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Gift subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeTrialDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke trial</DialogTitle>
          <DialogDescription>
            Mark the user&apos;s trial as expired. Their access will end immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="revoke-trial-notes">Reason</Label>
            <Textarea
              id="revoke-trial-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Required: why is the trial being revoked?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(notes)}
            disabled={!notes.trim() || busy}
          >
            {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Revoke trial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeSubscriptionDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke gifted subscription</DialogTitle>
          <DialogDescription>
            Cancel the complimentary subscription. The user&apos;s access will end immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="revoke-sub-notes">Reason</Label>
            <Textarea
              id="revoke-sub-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Required: why is the subscription being revoked?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(notes)}
            disabled={!notes.trim() || busy}
          >
            {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Revoke subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}