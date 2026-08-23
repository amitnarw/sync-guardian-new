"use client";

import { useState } from "react";
import { useLogin } from "@refinedev/core";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginCard({ error }: { error?: string }) {
  const { mutate: login } = useLogin();
  const [pending, setPending] = useState(false);

  return (
    <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden bg-background p-4">
      {/* Signature glow-orb gradients (AuthGradients) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full opacity-25 blur-3xl"
        style={{ background: "linear-gradient(135deg, #486730, #aed18f)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-32 size-[26rem] rounded-full opacity-20 blur-3xl"
        style={{ background: "linear-gradient(135deg, #9f402d, #ffb4a5)" }}
      />
      <Card className="relative z-10 w-full max-w-sm shadow-float">
        <CardHeader className="items-center text-center">
          <span
            className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full text-primary-foreground"
            style={{ background: "linear-gradient(135deg, #486730, #87a96b)" }}
          >
            <ShieldCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Sync Guardian Admin</CardTitle>
          <CardDescription>
            Sign in with your Google account to continue.
            <br />
            Only allowlisted admin emails are granted access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error === "config"
                ? "Authentication is not configured (missing environment variables)."
                : "Sign-in failed. Please try again."}
            </p>
          ) : null}
          <Button
            size="lg"
            disabled={pending}
            onClick={() => {
              setPending(true);
              login({}, { onSettled: () => setPending(false) });
            }}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
