/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CrudFilter } from "@refinedev/core";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  decryptNotification,
  encryptNotification,
} from "@/lib/notification-crypto";
import {
  getResource,
  type FieldConfig,
  type ResourceConfig,
  writableFields,
} from "@/lib/resources";

/**
 * supabase-js v2's query builders are deeply generic; our queries are
 * dynamic (driven by the resource registry), so we intentionally use a
 * loose builder type on the server.
 */
type LooseQuery = any;

function escapeIlike(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

function applyFilters(
  query: LooseQuery,
  filters: CrudFilter[],
  cfg: ResourceConfig,
): LooseQuery {
  let q = query;
  for (const filter of filters) {
    if ("or" in filter || "and" in filter) continue; // conditional filters unsupported
    const { field, operator, value } = filter as {
      field: string;
      operator: string;
      value: unknown;
    };
    if (value === undefined) continue;

    if (field === "__search__") {
      const term = escapeIlike(String(value));
      if (!term) continue;
      const parts = cfg.searchFields.map((f) => `${f}.ilike."%${term}%"`);
      if (parts.length > 0) q = q.or(parts.join(","));
      continue;
    }
    if (!cfg.searchFields.includes("__any__") && !cfg.fields.some((f) => f.name === field)) continue;

    switch (operator) {
      case "eq":
        q = q.eq(field, value);
        break;
      case "ne":
        q = q.neq(field, value);
        break;
      case "gt":
        q = q.gt(field, value);
        break;
      case "gte":
        q = q.gte(field, value);
        break;
      case "lt":
        q = q.lt(field, value);
        break;
      case "lte":
        q = q.lte(field, value);
        break;
      case "in":
        q = q.in(field, Array.isArray(value) ? value : [value]);
        break;
      case "contains":
        q = q.ilike(field, `%${escapeIlike(String(value))}%`);
        break;
      case "containss":
        q = q.like(field, `%${escapeIlike(String(value))}%`);
        break;
      case "startswith":
        q = q.ilike(field, `${escapeIlike(String(value))}%`);
        break;
      case "null":
        q = q.is(field, null);
        break;
      case "nnull":
        q = q.not(field, "is", null);
        break;
      default:
        break;
    }
  }
  return q;
}

/** Attaches `_<field>_label` for each configured relation. */
async function enrichRelations(
  rows: Record<string, unknown>[],
  relations: NonNullable<ResourceConfig["relations"]>,
): Promise<void> {
  if (rows.length === 0) return;
  const client = getServiceClient();
  await Promise.all(
    relations.map(async (rel) => {
      const relCfg = getResource(rel.resource);
      const table = relCfg?.table === "__auth_users" ? null : relCfg?.table;
      if (!table) return;
      const pkField = relCfg?.primaryKey ?? "id";
      const values = Array.from(
        new Set(rows.map((r) => r[rel.field]).filter((v) => v !== null && v !== undefined)),
      );
      if (values.length === 0) return;
      const { data } = await (client
        .from(table)
        .select(`${pkField},${rel.labelField}`)
        .in(pkField, values as string[]) as LooseQuery);
      const map = new Map<string, unknown>();
      for (const row of ((data ?? []) as unknown) as Record<string, unknown>[]) {
        const label = row[rel.labelField];
        if (label !== null && label !== undefined && label !== "") {
          map.set(String(row[pkField]), label);
        }
      }
      for (const row of rows) {
        const key = row[rel.field];
        row[`_${rel.field}_label`] =
          (key ? map.get(String(key)) : undefined) ?? shortId(key as string);
      }
    }),
  );
}

export interface PairedChild {
  pair_id: string;
  child_user_id: string;
  name: string;
  status: string;
  paired_at: string | null;
}

/**
 * Attaches `_children[]` (paired child users) to each parent trial row.
 * Children are looked up via pairs.child_user_id; display names come
 * from profiles with a shortId fallback.
 */
async function attachPairedChildren(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const client = getServiceClient();
  const parentIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter(Boolean).map(String)),
  );
  if (parentIds.length === 0) {
    for (const row of rows) row._children = [];
    return;
  }
  const { data: pairsData, error } = await (client
    .from("pairs")
    .select("id,parent_user_id,child_user_id,status,paired_at,created_at")
    .in("parent_user_id", parentIds)
    .order("created_at", { ascending: true }) as LooseQuery);
  if (error) throw new Error(error.message);
  const pairs = ((pairsData ?? []) as unknown) as {
    id: string;
    parent_user_id: string;
    child_user_id: string;
    status: string | null;
    paired_at: string | null;
  }[];

  const childIds = Array.from(new Set(pairs.map((p) => p.child_user_id)));
  const names = new Map<string, string>();
  if (childIds.length > 0) {
    const { data: profData } = await (client
      .from("profiles")
      .select("id,display_name")
      .in("id", childIds) as LooseQuery);
    for (const p of ((profData ?? []) as unknown) as Record<string, unknown>[]) {
      if (p.display_name) names.set(String(p.id), String(p.display_name));
    }
  }

  const byParent = new Map<string, typeof pairs>();
  for (const p of pairs) {
    const list = byParent.get(p.parent_user_id) ?? [];
    list.push(p);
    byParent.set(p.parent_user_id, list);
  }

  for (const row of rows) {
    const list = byParent.get(String(row.user_id)) ?? [];
    const children: PairedChild[] = list.map((p) => ({
      pair_id: p.id,
      child_user_id: p.child_user_id,
      name: names.get(p.child_user_id) ?? shortId(p.child_user_id),
      status: p.status ?? "unknown",
      paired_at: p.paired_at,
    }));
    row._children = children;
  }
}

export function shortId(id?: string | null): string {
  if (!id) return "";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export async function fetchList(
  resource: string,
  opts: {
    start: number;
    end: number;
    sortField?: string;
    sortOrder?: string;
    filters?: CrudFilter[];
  },
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const cfg = getResource(resource);
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);
  const client = getServiceClient();

  if (cfg.table === "__auth_users") return listAuthUsers(opts);

  // Reads may target a dedicated view (e.g. admin_parent_trials);
  // writes below always go to the base table.
  const readTable = cfg.readTable ?? cfg.table;

  let query: LooseQuery = client.from(readTable).select("*", { count: "exact" });
  if (opts.filters?.length) {
    query = applyFilters(query, opts.filters, cfg);
  }
  const sortField = opts.sortField || cfg.defaultSort.field;
  const ascending = (opts.sortOrder || cfg.defaultSort.order) === "asc";
  const { data, error, count } = await query
    .order(sortField, { ascending, nullsFirst: false })
    .range(Math.max(0, opts.start), Math.max(0, opts.end));
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown) as Record<string, unknown>[];
  if (cfg.encryptedPairField) {
    await Promise.all(
      rows.map(async (row) => {
        const pairId = row[cfg.encryptedPairField!];
        if (typeof pairId === "string") {
          Object.assign(row, await decryptNotification(row, pairId));
        }
      }),
    );
  }
  if (cfg.relations) await enrichRelations(rows, cfg.relations);
  if (cfg.name === "user-trials") await attachPairedChildren(rows);

  return { data: rows, total: count ?? 0 };
}

export async function fetchOne(
  resource: string,
  id: string,
): Promise<Record<string, unknown>> {
  const cfg = getResource(resource);
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);
  const client = getServiceClient();

  if (cfg.table === "__auth_users") {
    const { data, error } = await client.auth.admin.getUserById(id);
    if (error || !data.user) throw new Error(error?.message ?? "User not found");
    const row = authUserToRow(data.user);
    if (cfg.relations) await enrichRelations([row], cfg.relations);
    return row;
  }

  const { data, error } = (await (client
    .from(cfg.readTable ?? cfg.table)
    .select("*")
    .eq(cfg.primaryKey, id)
    .maybeSingle() as LooseQuery)) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${cfg.label} not found`);
  const row = data as Record<string, unknown>;
  if (cfg.encryptedPairField) {
    const pairId = row[cfg.encryptedPairField];
    if (typeof pairId === "string") Object.assign(row, await decryptNotification(row, pairId));
  }
  if (cfg.relations) await enrichRelations([row], cfg.relations);
  if (cfg.name === "user-trials") await attachPairedChildren([row]);
  return row;
}

function coerce(field: FieldConfig, raw: unknown): unknown {
  if (raw === "" || raw === undefined) return null;
  if (raw === null) return null;
  switch (field.type) {
    case "number":
    case "money-paise": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return Boolean(raw);
    case "json": {
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON in field "${field.label}"`);
      }
    }
    default:
      return String(raw);
  }
}

export function sanitizePayload(
  resource: string,
  payload: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  const cfg = getResource(resource);
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);
  if (cfg.table === "__auth_users") throw new Error("Auth users cannot be created or edited");
  const writable = writableFields(cfg).map((f) => f.name);
  const out: Record<string, unknown> = {};
  for (const field of cfg.fields) {
    if (!(field.name in payload)) continue;
    if (field.readOnly) continue;
    // Primary keys are immutable after creation.
    if (mode === "update" && field.name === cfg.primaryKey) continue;
    const isPkOnCreate = mode === "create" && field.name === cfg.primaryKey;
    if (!writable.includes(field.name) && !isPkOnCreate) continue;
    out[field.name] = coerce(field, payload[field.name]);
  }
  if (mode === "create") {
    for (const field of cfg.fields) {
      if (
        field.required &&
        !(field.name in out) &&
        !field.readOnly
      ) {
        // Allow DB defaults for booleans that are required by UI but defaulted server-side.
        if (!(field.type === "boolean")) {
          throw new Error(`Missing required field: ${field.label}`);
        }
      }
    }
  }
  if (Object.keys(out).length === 0) throw new Error("Nothing to write");
  return out;
}

export async function insertRow(
  resource: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const cfg = getResource(resource);
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);
  if (cfg.table === "__auth_users") throw new Error("Auth users cannot be created here");
  const client = getServiceClient();
  let values = sanitizePayload(resource, payload, "create");
  if (cfg.encryptedPairField) {
    const pairId = values[cfg.encryptedPairField];
    if (typeof pairId !== "string" || !pairId) {
      throw new Error("pair_id is required to encrypt notification content");
    }
    values = await encryptNotification(values, pairId);
  }
  const { data, error } = (await (client
    .from(cfg.table)
    .insert(values)
    .select()
    .single() as LooseQuery)) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function updateRow(
  resource: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const cfg = getResource(resource);
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);
  if (cfg.table === "__auth_users") throw new Error("Auth users cannot be edited here");
  const client = getServiceClient();
  let values = sanitizePayload(resource, payload, "update");
  if (cfg.encryptedPairField) {
    const pairId = values[cfg.encryptedPairField];
    if (typeof pairId === "string" && pairId) {
      values = await encryptNotification(values, pairId);
    }
  }
  const { data, error } = (await (client
    .from(cfg.table)
    .update(values)
    .eq(cfg.primaryKey, id)
    .select()
    .single() as LooseQuery)) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function deleteRow(
  resource: string,
  id: string,
): Promise<Record<string, unknown>> {
  const cfg = getResource(resource);
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const client = getServiceClient();
  if (cfg.table === "__auth_users") {
    const { error } = await client.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return { id };
  }

  const { data, error } = (await (client
    .from(cfg.table)
    .delete()
    .eq(cfg.primaryKey, id)
    .select()
    .maybeSingle() as LooseQuery)) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>) ?? { id };
}

function authUserToRow(user: {
  id: string;
  email?: string | null;
  phone?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  created_at?: string | null;
}): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email ?? "",
    phone: user.phone ?? "",
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    banned_until: user.banned_until ?? null,
    created_at: user.created_at ?? null,
  };
}

async function listAuthUsers(opts: {
  start: number;
  end: number;
}): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const client = getServiceClient();
  const page = Math.floor(Math.max(0, opts.start) / Math.max(1, opts.end - opts.start + 1)) + 1;
  const perPage = Math.max(1, opts.end - opts.start + 1);
  const { data, error } = await client.auth.admin.listUsers({ page, perPage });
  if (error) throw new Error(error.message);
  const users = data.users.map(authUserToRow);
  return { data: users, total: data.total ?? users.length };
}
