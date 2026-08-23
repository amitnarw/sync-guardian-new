"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";import { useDelete, useOne } from "@refinedev/core";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CellValue } from "@/components/resource/cell-value";
import { TONE_CLASSES, formatDate, toneForValue } from "@/lib/format";
import type { ResourceConfig } from "@/lib/resources";

type Row = Record<string, unknown>;

interface PairedChildRow {
  pair_id: string;
  child_user_id: string;
  name: string;
  status: string;
  paired_at: string | null;
}

function getChildren(row: Row | null): PairedChildRow[] {
  const children = row?._children;
  return Array.isArray(children) ? (children as PairedChildRow[]) : [];
}

export function ShowView({ cfg, id }: { cfg: ResourceConfig; id: string }) {
  const router = useRouter();
  const { result, query } = useOne<Row>({ resource: cfg.name, id });
  const { mutate: deleteRow } = useDelete();
  const [deleting, setDeleting] = useState(false);

  // Refine v5 flattens useOne results: `result` is already the record.
  const row = (result ?? null) as Row | null;
  const children = getChildren(row);

  const handleDelete = () => {
    setDeleting(true);
    deleteRow(
      { resource: cfg.name, id },
      {
        onSuccess: () => {
          toast.success("Record deleted");
          router.push(`/r/${cfg.name}`);
        },
        onError: (error) =>
          toast.error((error as { message?: string }).message ?? "Delete failed"),
        onSettled: () => setDeleting(false),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="size-8" asChild>
            <Link href={`/r/${cfg.name}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{cfg.label}</h1>
        </div>
        <div className="flex items-center gap-2">
          {cfg.canEdit ? (
            <Button variant="outline" asChild>
              <Link href={`/r/${cfg.name}/edit/${encodeURIComponent(id)}`}>Edit</Link>
            </Button>
          ) : null}
          {cfg.canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete…</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove it
                    {cfg.danger ? ", possibly cascading to related data" : ""}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                  >
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="break-all font-mono text-sm text-muted-foreground">
            {cfg.primaryKey}: {id}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full max-w-md" />
              ))}
            </div>
          ) : query.isError || !row ? (
            <p className="py-6 text-destructive">
              {(query.error as { message?: string })?.message ?? "Record not found."}
            </p>
          ) : (
            cfg.fields.map((f, idx) => (
              <div key={f.name}>
                {idx > 0 ? <Separator className="my-3" /> : null}
                <div className="grid grid-cols-1 gap-1 py-1 sm:grid-cols-[220px_1fr] sm:gap-4">
                  <span className="text-sm font-medium text-muted-foreground">{f.label}</span>
                  <CellValue field={f} row={row} cfg={cfg} compact={false} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {children.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Paired Children ({children.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {children.map((c) => (
              <div key={c.pair_id} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {c.name}
                </Badge>
                <Badge className={`text-xs ${TONE_CLASSES[toneForValue(c.status)]}`}>
                  {c.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  paired {formatDate(c.paired_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
