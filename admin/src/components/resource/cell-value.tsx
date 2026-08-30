"use client";

import { useState, type ReactNode } from "react";
import { Baby, Check, Copy, Lock, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldConfig, ResourceConfig } from "@/lib/resources";
import {
  TONE_CLASSES,
  formatDate,
  formatPaise,
  formatRelative,
  shortId,
  toneForValue,
} from "@/lib/format";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 text-muted-foreground"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => toast.error("Copy failed"));
      }}
      aria-label="Copy value"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </Button>
  );
}

export function BooleanBadge({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">, </span>;
  const on = Boolean(value);
  return (
    <Badge variant="outline" className={on ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"}>
      <span className={`mr-1 inline-block size-2 rounded-full ${on ? "bg-emerald-500" : "bg-gray-400"}`} />
      {on ? "Yes" : "No"}
    </Badge>
  );
}

/** Distinct solid badges per role ,  recognizable by icon + color at a glance. */
const ROLE_META: Record<string, { className: string; Icon: LucideIcon }> = {
  parent: { className: "bg-primary text-primary-foreground", Icon: UserRound },
  child: { className: "bg-[#c9eea9] text-[#0b2000]", Icon: Baby },
  admin: { className: "bg-[#745853] text-white", Icon: ShieldCheck },
};

function RoleBadge({ label, meta }: { label: string; meta: { className: string; Icon: LucideIcon } }) {
  return (
    <Badge className={`gap-1 ${meta.className}`}>
      <meta.Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function SelectBadge({ field, row }: { field: FieldConfig; row: Record<string, unknown> }) {
  const raw = row[field.name];
  if (raw === null || raw === undefined || raw === "") {
    return <span className="text-muted-foreground">, </span>;
  }
  const value = String(raw);
  const label = field.options?.find((o) => o.value === value)?.label ?? value;
  const roleMeta = ROLE_META[value];
  if (roleMeta) return <RoleBadge label={label} meta={roleMeta} />;
  const tone = toneForValue(value);
  return <Badge className={TONE_CLASSES[tone]}>{label}</Badge>;
}

/** Renders a single cell value for list/show views. */
export function CellValue({
  field,
  row,
  cfg,
  compact = true,
}: {
  field: FieldConfig;
  row: Record<string, unknown>;
  cfg?: ResourceConfig;
  compact?: boolean;
}): ReactNode {
  const value = row[field.name];
  const relationLabel = row[`_${field.name}_label`];

  switch (field.type) {
    case "boolean":
      return <BooleanBadge value={value} />;
    case "select":
      return <SelectBadge field={field} row={row} />;
    case "datetime": {
      if (!value) return <span className="text-muted-foreground">, </span>;
      return (
        <span title={formatRelative(value as string)}>{formatDate(value as string)}</span>
      );
    }
    case "money-paise":
      return <span className="tabular-nums">{formatPaise(value as number)}</span>;
    case "number":
      if (value === null || value === undefined) return <span className="text-muted-foreground">, </span>;
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
    case "textarea": {
      const text = value == null || value === "" ? "" : String(value);
      if (!text) return <span className="text-muted-foreground">, </span>;
      if (compact) {
        return (
          <span className="block max-w-[280px] truncate text-muted-foreground" title={text}>
            {text}
          </span>
        );
      }
      return <span className="whitespace-pre-wrap">{text}</span>;
    }
    case "json": {
      const json = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      if (!json || json === "null") return <span className="text-muted-foreground">, </span>;
      if (compact) return <code className="font-mono text-xs">{shortId(json)}</code>;
      return (
        <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
          {json}
        </pre>
      );
    }
    default:
      break;
  }

  // Plain text-ish fields
  const str = value == null || value === "" ? null : String(value);
  if (!str) return <span className="text-muted-foreground">, </span>;

  if (str.startsWith("nv1:")) {
    return (
      <Badge variant="outline" className="gap-1 font-mono text-xs">
        <Lock className="size-3" /> encrypted
      </Badge>
    );
  }

  const relation = cfg?.relations?.find((r) => r.field === field.name);
  const display =
    relation && relationLabel
      ? String(relationLabel)
      : field.truncate && compact && !field.monospace
        ? str
        : field.monospace && compact
          ? shortId(str)
          : str;

  return (
    <span className="inline-flex max-w-full items-center gap-0.5">
      <span
        className={`${field.monospace ? "font-mono text-xs" : ""} ${field.truncate && compact ? "max-w-[220px] truncate" : "break-all"}`}
        title={str}
      >
        {display}
      </span>
      {field.copyable ? <CopyButton value={str} /> : null}
    </span>
  );
}
