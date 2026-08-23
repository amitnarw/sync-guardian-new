"use client";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { LogOut, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface Identity {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export function SiteHeader() {
  const { data: identity } = useGetIdentity<Identity>();
  const { mutate: logout } = useLogout();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 !h-4" />
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <ShieldAlert className="size-3.5" />
          Restricted access
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2">
              <Avatar className="size-6">
                {identity?.avatar_url ? (
                  <AvatarImage src={identity.avatar_url} alt={identity.name ?? ""} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {(identity?.name ?? identity?.email ?? "?").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[180px] truncate text-sm">{identity?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="truncate">{identity?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
