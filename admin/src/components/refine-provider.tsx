"use client";

import { useMemo } from "react";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import type { IResourceItem } from "@refinedev/core";
import { dataProvider } from "@/providers/data-provider";
import { authProvider } from "@/providers/auth-provider";
import { RESOURCES } from "@/lib/resources";

export function RefineProvider({ children }: { children: React.ReactNode }) {
  const resources = useMemo<IResourceItem[]>(
    () =>
      RESOURCES.map((r) => ({
        name: r.name,
        list: "/r/" + r.name,
        create: r.canCreate ? (`/r/${r.name}/new` as const) : undefined,
        edit: r.canEdit ? (`/r/${r.name}/edit/:id` as const) : undefined,
        show: `/r/${r.name}/show/:id`,
        meta: { label: r.label },
      })),
    [],
  );

  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={dataProvider}
      authProvider={authProvider}
      resources={resources}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        disableTelemetry: true,
        reactQuery: {
          clientConfig: {
            defaultOptions: {
              queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
            },
          },
        },
      }}
    >
      {children}
    </Refine>
  );
}
