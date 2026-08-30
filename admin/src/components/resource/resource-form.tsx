"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreate, useDelete, useOne, useUpdate } from "@refinedev/core";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldConfig, ResourceConfig } from "@/lib/resources";

type Row = Record<string, unknown>;

function toFormValues(cfg: ResourceConfig, row?: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    if (f.hiddenInForm || f.readOnly) continue;
    const v = row?.[f.name];
    switch (f.type) {
      case "json":
        out[f.name] = v === null || v === undefined ? "" : JSON.stringify(v, null, 2);
        break;
      case "datetime": {
        if (!v) {
          out[f.name] = "";
          break;
        }
        const d = new Date(v as string);
        if (Number.isNaN(d.getTime())) {
          out[f.name] = "";
        } else {
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
          out[f.name] = local.toISOString().slice(0, 16);
        }
        break;
      }
      default:
        out[f.name] = v ?? "";
    }
  }
  return out;
}

function transformForSubmit(
  cfg: ResourceConfig,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    if (f.hiddenInForm || f.readOnly) continue;
    if (!(f.name in values)) continue;
    const raw = values[f.name];
    switch (f.type) {
      case "number":
      case "money-paise": {
        const n = Number(raw);
        if (raw !== "" && raw !== null && !Number.isFinite(n)) {
          throw new Error(`"${f.label}" must be a number`);
        }
        out[f.name] = raw === "" || raw === null ? null : n;
        break;
      }
      case "boolean":
        out[f.name] = Boolean(raw);
        break;
      case "datetime": {
        if (raw === "" || raw === null || raw === undefined) {
          out[f.name] = null;
        } else {
          const d = new Date(String(raw));
          if (Number.isNaN(d.getTime())) throw new Error(`Invalid date in "${f.label}"`);
          out[f.name] = d.toISOString();
        }
        break;
      }
      case "json": {
        const s = String(raw ?? "").trim();
        if (s === "") {
          out[f.name] = null;
        } else {
          try {
            out[f.name] = JSON.parse(s);
          } catch {
            throw new Error(`Invalid JSON in "${f.label}"`);
          }
        }
        break;
      }
      default: {
        const s = String(raw ?? "").trim();
        if (f.required && s === "") throw new Error(`"${f.label}" is required`);
        out[f.name] = s === "" ? null : s;
      }
    }
  }
  return out;
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}): ReactNode {
  const id = `field-${field.name}`;

  switch (field.type) {
    case "boolean":
      return <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />;
    case "select":
      return (
        <Select
          value={value == null || value === "" ? "__null__" : String(value)}
          onValueChange={(v) => onChange(v === "__null__" ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {!field.required ? <SelectItem value="__null__">,  none , </SelectItem> : null}
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "textarea":
    case "json":
      return (
        <Textarea
          id={id}
          rows={field.type === "json" ? 8 : field.name.includes("token") ? 6 : 4}
          className={`resize-y ${field.type === "json" ? "font-mono text-xs" : ""}`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "json" ? '{ "key": "value" }' : undefined}
        />
      );
    case "number":
    case "money-paise":
      return (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "datetime":
      return (
        <Input
          id={id}
          type="datetime-local"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Input
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.monospace ? "uuid / key…" : undefined}
        />
      );
  }
}

export function ResourceForm({
  cfg,
  mode,
  id,
}: {
  cfg: ResourceConfig;
  mode: "create" | "edit";
  id?: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = mode === "edit" && Boolean(id);

  const oneQuery = useOne<Row>({
    resource: cfg.name,
    id: id ?? "",
    queryOptions: { enabled: isEdit },
  });

  // `loadedData` is `undefined` until the fetch resolves. We mirror it into
  // local form state via useEffect (not at render time) to avoid React 19
  // warnings and dropped updates in Strict/Concurrent mode.
  const loadedData = isEdit ? (oneQuery.result as Row | undefined) : undefined;
  const [lastLoaded, setLastLoaded] = useState<Row | undefined>(undefined);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    toFormValues(cfg),
  );

  useEffect(() => {
    // Mirroring async fetched data into local form state is the standard
    // Refine pattern for editable forms. The parent hook owns the canonical
    // record; the form mirrors it into editable local state so a derived
    // selector does not re-render on every keystroke.
    if (loadedData && loadedData !== lastLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastLoaded(loadedData);
      setValues(toFormValues(cfg, loadedData));
    }
  }, [loadedData, lastLoaded, cfg]);

  const { mutate: createRow } = useCreate<Row>();
  const { mutate: updateRow } = useUpdate<Row>();
  const { mutate: deleteRow } = useDelete();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = () => {
    setFormError(null);
    let payload: Record<string, unknown>;
    try {
      payload = transformForSubmit(cfg, values);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Validation failed");
      return;
    }

    if (mode === "create") {
      setSaving(true);
      createRow(
        { resource: cfg.name, values: payload },
        {
          onSuccess: () => {
            toast.success(`${cfg.label.replace(/s$/, "")} created`);
            router.push(`/r/${cfg.name}`);
          },
          onError: (error) =>
            setFormError((error as { message?: string }).message ?? "Create failed"),
          onSettled: () => setSaving(false),
        },
      );
    } else {
      setSaving(true);
      updateRow(
        { resource: cfg.name, id: id!, values: payload },
        {
          onSuccess: () => {
            toast.success("Changes saved");
            router.push(`/r/${cfg.name}`);
          },
          onError: (error) =>
            setFormError((error as { message?: string }).message ?? "Update failed"),
          onSettled: () => setSaving(false),
        },
      );
    }
  };

  const handleDelete = () => {
    setDeleting(true);
    deleteRow(
      { resource: cfg.name, id: id! },
      {
        onSuccess: () => {
          toast.success(`${cfg.label} record deleted`);
          router.push(`/r/${cfg.name}`);
        },
        onError: (error) =>
          toast.error((error as { message?: string }).message ?? "Delete failed"),
        onSettled: () => setDeleting(false),
      },
    );
  };

  const editableFields = cfg.fields.filter(
    (f) => !f.hiddenInForm && (!f.readOnly || (mode === "create" && f.name === cfg.primaryKey)),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="size-8" asChild>
          <Link href={`/r/${cfg.name}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "create" ? `New ${cfg.label.replace(/s$/, "")}` : `Edit ${cfg.label}`}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            {mode === "create"
              ? `Fill in the fields to create a new ${cfg.table} row.`
              : `Editing row ${id}`}
            {cfg.encryptedRelationshipFields ? (
              <span className="mt-1 block">
                Encrypted content fields are encrypted server-side before storage.
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {oneQuery.query.isError && isEdit ? (
            <Alert variant="destructive">
              <AlertTitle>Failed to load record</AlertTitle>
              <AlertDescription>
                {(oneQuery.query.error as { message?: string })?.message ?? "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : null}

          {oneQuery.query.isLoading && isEdit ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading record…
            </div>
          ) : (
            editableFields.map((f: FieldConfig, idx) => (
              <div key={f.name}>
                {idx > 0 ? <Separator className="mb-5" /> : null}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor={`field-${f.name}`}>
                      {f.label}
                      {f.required ? <span className="ml-0.5 text-destructive">*</span> : null}
                    </Label>
                    {f.helpText ? (
                      <span className="text-xs text-muted-foreground">{f.helpText}</span>
                    ) : null}
                  </div>
                  <FieldControl
                    field={f}
                    value={values[f.name]}
                    onChange={(v) => {
                      setValues((prev) => ({ ...prev, [f.name]: v }));
                      setFormError(null);
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>

        <CardFooter className="justify-between">
          {isEdit && cfg.canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  Delete…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove it{cfg.danger ? ", possibly cascading to related data" : ""}. This cannot be undone.
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
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href={`/r/${cfg.name}`}>Cancel</Link>
            </Button>
            <Button onClick={handleSubmit} disabled={saving || oneQuery.query.isLoading}>
              {saving ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
