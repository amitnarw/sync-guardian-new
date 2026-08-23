"use client";

import { useLogout } from "@refinedev/core";
import { LogOut, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotAllowedPage() {
  const { mutate: logout } = useLogout();

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldX className="size-6" />
          </span>
          <CardTitle className="text-xl">Access denied</CardTitle>
          <CardDescription>
            Your account is signed in, but its email is not on the admin allowlist.
            Ask an operator to add your email to the{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              ADMIN_EMAILS
            </code>{" "}
            environment variable.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
