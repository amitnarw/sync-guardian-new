"use client";

import Link from "next/link";
import { useCustom } from "@refinedev/core";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Hourglass,
  Link2,
  QrCode,
  Smartphone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import { formatDate } from "@/lib/format";

interface DashboardStats {
  totalUsers: number;
  totalDevices: number;
  pairs: { total: number; active: number; revoked: number; pending: number };
  subscriptions: {
    active: number;
    pending: number;
    cancelled: number;
    expired: number;
  };
  totalNotifications: number;
  trialsActive: number;
  tokensActive: number;
  plansActive: number;
}

interface RecentNotification {
  id: string;
  notification_title?: string | null;
  notification_body?: string | null;
  source_app_name?: string | null;
  notification_posted_at?: string | null;
}

interface DashboardResponse {
  stats: DashboardStats;
  notificationSeries: { date: string; count: number }[];
  recentNotifications: RecentNotification[];
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { result, query } = useCustom<DashboardResponse>({
    url: "/api/dashboard",
    method: "get",
  });

  const data = result?.data;

  if (query.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (query.isError || !data?.stats) {
    return (
      <Card>
        <CardContent className="pt-6 text-destructive">
          Failed to load dashboard. Is the API configured?
        </CardContent>
      </Card>
    );
  }

  const { stats, notificationSeries, recentNotifications } = data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live overview of the Sync Guardian platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Users" value={stats.totalUsers} icon={Users} />
        <StatCard
          title="Devices"
          value={stats.totalDevices}
          icon={Smartphone}
          sub={`${stats.trialsActive} active trials`}
        />
        <StatCard
          title="Active Pairs"
          value={stats.pairs.active}
          icon={Link2}
          sub={`${stats.pairs.pending} pending · ${stats.pairs.revoked} revoked`}
        />
        <StatCard
          title="Notifications"
          value={stats.totalNotifications.toLocaleString()}
          icon={Bell}
        />
        <StatCard
          title="Active Subscriptions"
          value={stats.subscriptions.active}
          icon={Users}
          sub={`${stats.subscriptions.cancelled} cancelled · ${stats.subscriptions.expired} expired`}
        />
        <StatCard
          title="Pending Subs"
          value={stats.subscriptions.pending}
          icon={Hourglass}
        />
        <StatCard
          title="Unconsumed Tokens"
          value={stats.tokensActive}
          icon={QrCode}
        />
        <StatCard title="Active Plans" value={stats.plansActive} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notifications · last 14 days</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={notificationSeries} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="fillNotifs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={40} />
                <ChartTooltip
                  contentStyle={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-primary)"
                  fill="url(#fillNotifs)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentNotifications.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {n.notification_title ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {n.source_app_name ?? n.notification_title?.slice(0, 24) ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(n.notification_posted_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-3 text-right">
              <Link href="/r/mirrored-notifications">
                <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                  View all →
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
