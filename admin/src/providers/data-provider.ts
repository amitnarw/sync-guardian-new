import type {
  BaseRecord,
  CreateParams,
  DataProvider,
  DeleteOneParams,
  GetListParams,
  GetOneParams,
  HttpError,
  UpdateParams,
} from "@refinedev/core";

const API_URL = "/api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // ignore body parse errors
    }
    throw { message, statusCode: res.status } as HttpError;
  }
  return (await res.json()) as T;
}

function buildListQuery(
  pagination?: { currentPage?: number; pageSize?: number },
  sorters?: { field: string; order: string }[],
  filters?: unknown[],
): string {
  const page = pagination?.currentPage ?? 1;
  const size = pagination?.pageSize ?? 25;
  const start = (page - 1) * size;
  const params = new URLSearchParams({
    start: String(start),
    end: String(start + size - 1),
  });
  const sort = sorters?.[0];
  if (sort) {
    params.set("sortField", sort.field);
    params.set("sortOrder", sort.order);
  }
  if (filters?.length) params.set("filters", JSON.stringify(filters));
  return params.toString();
}

export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async <TData extends BaseRecord = BaseRecord>(params: GetListParams) => {
    const { resource, pagination, sorters, filters } = params;
    const query = buildListQuery(pagination, sorters, filters);
    const json = await handle<{ data: TData[]; total: number }>(
      await fetch(`${API_URL}/${resource}?${query}`, { credentials: "include" }),
    );
    return { data: json.data, total: json.total };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(params: GetOneParams) => {
    const { resource, id } = params;
    return handle<{ data: TData }>(
      await fetch(`${API_URL}/${resource}/${encodeURIComponent(String(id))}`, {
        credentials: "include",
      }),
    );
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ) => {
    const { resource, variables } = params;
    return handle<{ data: TData }>(
      await fetch(`${API_URL}/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(variables),
      }),
    );
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ) => {
    const { resource, id, variables } = params;
    return handle<{ data: TData }>(
      await fetch(`${API_URL}/${resource}/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(variables),
      }),
    );
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ) => {
    const { resource, id } = params;
    return handle<{ data: TData }>(
      await fetch(`${API_URL}/${resource}/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        credentials: "include",
      }),
    );
  },

  custom: async <TData extends BaseRecord = BaseRecord, TQuery = unknown, TPayload = unknown>(
    params: import("@refinedev/core").CustomParams<TQuery, TPayload>,
  ) => {
    const { url, method, payload } = params;
    const target = url.startsWith(API_URL) ? url : `${API_URL}${url}`;
    return handle<{ data: TData }>(
      await fetch(target, {
        method: method.toUpperCase(),
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: payload ? JSON.stringify(payload) : undefined,
      }),
    );
  },
};
