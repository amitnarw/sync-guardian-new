import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function shortId(id?: string | null): string {
  if (!id) return "";
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("MMM D, YYYY HH:mm") : String(value);
}

export function formatRelative(value?: string | null): string {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.fromNow() : "";
}

export function formatPaise(paise?: number | null): string {
  if (paise === null || paise === undefined) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_BY_VALUE: Record<string, Tone> = {
  active: "success",
  success: "success",
  completed: "success",
  used: "success",
  parent: "info",
  child: "info",
  monthly: "neutral",
  yearly: "neutral",
  pending: "warning",
  paused: "warning",
  tier_a: "info",
  tier_b: "info",
  social: "info",
  messaging: "warning",
  dating: "danger",
  revoked: "danger",
  cancelled: "danger",
  failed: "danger",
  expired: "danger",
  unregistered: "danger",
};

export function toneForValue(value: string): Tone {
  return TONE_BY_VALUE[value.toLowerCase()] ?? "neutral";
}

export const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-[#c9eea9] text-[#0b2000]",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-[#ffdad6] text-[#93000a]",
  info: "bg-[#ffdad3] text-[#802918]",
  neutral: "bg-muted text-muted-foreground",
};
