"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  FileText,
  Filter,
  History,
  Hourglass,
  IdCard,
  LayoutDashboard,
  Link2,
  ListChecks,
  QrCode,
  Send,
  Shapes,
  ShieldCheck,
  Smartphone,
  CreditCard,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { RESOURCES, RESOURCE_GROUPS } from "@/lib/resources";

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  users: Users,
  profiles: IdCard,
  "user-onboarding-state": ListChecks,
  devices: Smartphone,
  pairs: Link2,
  "pairing-tokens": QrCode,
  "mirrored-notifications": Bell,
  "push-delivery-logs": Send,
  "child-app-filters": Filter,
  plans: CreditCard,
  subscriptions: BadgeCheck,
  "subscription-events": History,
  "user-trials": Hourglass,
  "app-categories": Shapes,
  "legal-documents": FileText,
};

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  asChild
                  className="rounded-2xl"
                >
              <Link href="/">
                <span
                  className="flex size-8 items-center justify-center rounded-full text-primary-foreground"
                  style={{ background: "linear-gradient(135deg, #486730, #87a96b)" }}
                >
                  <ShieldCheck className="size-4" />
                </span>
                <span className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Sync Guardian</span>
                  <span className="text-xs text-muted-foreground">Admin Panel</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                  className="rounded-full data-[active=true]:bg-[#c9eea9] data-[active=true]:text-[#0b2000]"
                >
                  <Link href="/">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {RESOURCE_GROUPS.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {RESOURCES.filter((r) => r.group === group).map((resource) => {
                  const base = `/r/${resource.name}`;
                  const active =
                    pathname === base || pathname.startsWith(`${base}/`);
                  const Icon = RESOURCE_ICONS[resource.name] ?? UserRound;
                  return (
                    <SidebarMenuItem key={resource.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="rounded-full data-[active=true]:bg-[#c9eea9] data-[active=true]:text-[#0b2000]"
                      >
                        <Link href={base}>
                          <Icon />
                          <span>{resource.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
