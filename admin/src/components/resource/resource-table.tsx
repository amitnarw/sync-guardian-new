"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useDelete, useTable, type CrudFilter } from "@refinedev/core";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CellValue } from "@/components/resource/cell-value";
import { TONE_CLASSES, formatDate, toneForValue } from "@/lib/format";
import type { FieldConfig, ResourceConfig } from "@/lib/resources";

type Row = Record<string, unknown>;

const ENCRYPTED_FIELDS = new Set([
  "notification_title",
  "notification_body",
  "source_package",
  "source_app_name",
]);

interface PairedChildRow {
  pair_id: string;
  child_user_id: string;
  name: string;
  status: string;
  paired_at: string | null;
}

function getChildren(row: Row): PairedChildRow[] {
  const children = row._children;
  return Array.isArray(children) ? (children as PairedChildRow[]) : [];
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function RowActions({
  cfg,
  row,
  onAskDelete,
  expanded,
  onToggleExpand,
}: {
  cfg: ResourceConfig;
  row: Row;
  onAskDelete: (row: Row) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const pk = String(row[cfg.primaryKey]);
  const hasChildren = getChildren(row).length > 0;
  return (
    <div
      className="flex items-center justify-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {hasChildren ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title={expanded ? "Hide paired children" : "Show paired children"}
          aria-expanded={expanded}
          onClick={onToggleExpand}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" className="size-7" asChild>
        <Link href={`/r/${cfg.name}/show/${encodeURIComponent(pk)}`} title="View">
          <Eye className="size-3.5" />
        </Link>
      </Button>
      {cfg.canEdit ? (
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href={`/r/${cfg.name}/edit/${encodeURIComponent(pk)}`} title="Edit">
            <Pencil className="size-3.5" />
          </Link>
        </Button>
      ) : null}
      {cfg.canDelete ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          title="Delete"
          onClick={() => onAskDelete(row)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function ChildrenList({ items }: { items: PairedChildRow[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Paired children ({items.length})
      </p>
      <div className="flex flex-col gap-1">
        {items.map((c) => (
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
      </div>
    </div>
  );
}

export function ResourceTable({ cfg }: { cfg: ResourceConfig }) {
  const {
    tableQuery,
    sorters,
    setSorters,
    setFilters,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    pageCount,
    result,
  } = useTable<Row>({
    resource: cfg.name,
    pagination: { currentPage: 1, pageSize: 25, mode: "server" },
    sorters: { initial: [cfg.defaultSort], mode: "server" },
    filters: { mode: "server" },
    syncWithLocation: false,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [enumValues, setEnumValues] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpanded = (pk: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });

  const { mutate: deleteOne } = useDelete();
  const [deleting, setDeleting] = useState(false);

  // Skip the initial run so mounting doesn't trigger a redundant refetch —
  // useTable already performs the first fetch with default state.
  const isFirstFiltersRun = useRef(true);

  useEffect(() => {
    if (isFirstFiltersRun.current) {
      isFirstFiltersRun.current = false;
      return;
    }
    const next: CrudFilter[] = [];
    if (debouncedSearch.trim()) {
      next.push({
        field: "__search__",
        operator: "contains",
        value: debouncedSearch.trim(),
      });
    }
    for (const [field, value] of Object.entries(enumValues)) {
      if (value) next.push({ field, operator: "eq", value });
    }
    setFilters(next, "replace");
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, enumValues]);

  const sorting = useMemo<SortingState>(
    () => sorters.map((s) => ({ id: s.field, desc: s.order === "desc" })),
    [sorters],
  );

  const listFields = cfg.fields.filter((f) => !f.hiddenInList);
  const quickFilterFields = listFields.filter((f) => f.type === "select").slice(0, 2);

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = listFields.map((f: FieldConfig) => {
      const isEncrypted = Boolean(cfg.encryptedRelationshipFields) && ENCRYPTED_FIELDS.has(f.name);
      const isRelation = cfg.relations?.some((r) => r.field === f.name) ?? false;
      return {
        id: f.name,
        accessorFn: (row) => row[f.name],
        header: f.label,
        cell: ({ row }) => <CellValue field={f} row={row.original} cfg={cfg} />,
        enableSorting: !isEncrypted && !isRelation,
      };
    });
    cols.push({
      id: "__actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const pk = String(row.original[cfg.primaryKey] ?? "");
        return (
          <RowActions
            cfg={cfg}
            row={row.original}
            onAskDelete={setPendingDelete}
            expanded={expandedRows.has(pk)}
            onToggleExpand={() => toggleExpanded(pk)}
          />
        );
      },
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, expandedRows]);

  const table = useReactTable({
    data: result?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    pageCount,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const last = next[next.length - 1];
      if (!last || (!last.desc && sorters[0]?.field === last.id && sorters[0]?.order === "asc")) {
        setSorters([cfg.defaultSort]);
      } else {
        setSorters([{ field: last.id, order: last.desc ? "desc" : "asc" }]);
      }
      setCurrentPage(1);
    },
  });

  const total = result?.total ?? 0;
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(total, currentPage * pageSize);

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const pk = String(pendingDelete[cfg.primaryKey]);
    setDeleting(true);
    deleteOne(
      { resource: cfg.name, id: pk },
      {
        onSuccess: () => {
          toast.success(`${cfg.label.replace(/s$/, "")} deleted`);
          setPendingDelete(null);
        },
        onError: (error) => {
          toast.error(
            (error as { message?: string }).message ?? "Delete failed",
          );
          setPendingDelete(null);
        },
        onSettled: () => setDeleting(false),
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {cfg.label}
            <Badge variant="secondary" className="tabular-nums">
              {total.toLocaleString()}
            </Badge>
          </h1>
          {cfg.description ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{cfg.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {cfg.canCreate ? (
            <Button asChild>
              <Link href={`/r/${cfg.name}/new`}>
                <Plus className="mr-1 size-4" /> New
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              cfg.searchFields.length > 0
                ? `Search ${cfg.searchFields.join(", ")}…`
                : "Search…"
            }
            disabled={cfg.searchFields.length === 0}
            className="w-72 pl-8 pr-8"
          />
          {searchTerm ? (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {quickFilterFields.map((f) => (
          <Select
            key={f.name}
            value={enumValues[f.name] ?? ""}
            onValueChange={(v) =>
              setEnumValues((prev) => ({ ...prev, [f.name]: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={`${f.label}: All`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All {f.label}</SelectItem>
              {(f.options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => tableQuery.refetch()}
          disabled={tableQuery.isRefetching}
        >
          <RefreshCcw className={`mr-1 size-3.5 ${tableQuery.isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {tableQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load {cfg.label}</AlertTitle>
          <AlertDescription>
            {(tableQuery.error as { message?: string })?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Table */}
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/50 hover:bg-muted/50">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap font-medium">
                      {canSort ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUp className="size-3.5 opacity-20" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {tableQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {table.getAllLeafColumns().map((c) => (
                    <TableCell key={c.id}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const pk = String(row.original[cfg.primaryKey] ?? row.id);
                const children = getChildren(row.original);
                const expanded = expandedRows.has(pk);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className={
                        children.length > 0 ? "cursor-pointer" : undefined
                      }
                      onClick={
                        children.length > 0
                          ? () => toggleExpanded(pk)
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="max-w-[320px] align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {children.length > 0 && expanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={columns.length}
                          className="bg-muted/30 px-4 py-3"
                        >
                          <ChildrenList items={children} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {start}–{end} of {total.toLocaleString()}
        </p>
        <div className="flex items-center gap-4">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums text-muted-foreground">
              Page {currentPage} / {Math.max(1, pageCount)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage(pageCount)}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You are about to permanently delete a{" "}
                  <strong>{cfg.label.replace(/s$/, "")}</strong> record.
                  {cfg.danger ? (
                    <span className="mt-1 block font-medium text-destructive">
                      This operation may cascade to related data. This cannot be undone.
                    </span>
                  ) : (
                    <span className="mt-1 block">This action cannot be undone.</span>
                  )}
                </p>
                <code className="block rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                  {pendingDelete ? String(pendingDelete[cfg.primaryKey]) : ""}
                </code>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
