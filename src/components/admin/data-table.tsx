"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * The table behind every admin list view.
 *
 * Deliberately presentational: it renders rows, a search box and pagination,
 * and reports what the user did through callbacks. Fetching, sorting and
 * filtering stay with the page, which is what lets the same component back
 * server-paginated orders and a fully client-side category list.
 */

export interface Column<T> {
  /** Stable key — also used as the sort key when `sortable` is set. */
  key: string;
  header: string;
  /** Cell contents. Return a string/number or any node. */
  cell: (row: T) => React.ReactNode;
  /** Ask the parent to sort by this column's key. */
  sortable?: boolean;
  /** Tailwind width utility, e.g. "w-32". */
  width?: string;
  /** Right-align — use for money and counts. */
  align?: "left" | "right" | "center";
  /** Hide below the given breakpoint so narrow screens stay readable. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  /** Stable identity for React keys and row callbacks. */
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;

  /** Clicking a row — usually opens the edit form. */
  onRowClick?: (row: T) => void;

  /** Search box. Omit `onSearchChange` to hide it. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Sorting, driven by the parent. */
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (key: string, order: "asc" | "desc") => void;

  /** Pagination. Omit `onPageChange` to hide the footer. */
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;

  /** Shown when there are no rows and no search term. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  /** Rendered above the table, right of the search box. */
  toolbar?: React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  sort,
  order = "desc",
  onSortChange,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  toolbar,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showFooter = Boolean(onPageChange) && total > pageSize;

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;
    // Same column flips direction; a new column starts descending, which is
    // what you want for dates and amounts.
    const nextOrder = sort === column.key && order === "desc" ? "asc" : "desc";
    onSortChange(column.key, nextOrder);
  };

  return (
    <div className="space-y-4">
      {(onSearchChange || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {onSearchChange && (
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
          {toolbar && <div className="flex shrink-0 items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sort === column.key
                        ? order === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                      column.width,
                      alignClass(column.align),
                      hideClass(column.hideBelow),
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        {column.header}
                        <SortIndicator active={sort === column.key} order={order} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <StateRow colSpan={columns.length}>
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </StateRow>
              ) : error ? (
                <StateRow colSpan={columns.length}>
                  <p className="text-sm text-destructive">{error}</p>
                  {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Try again
                    </Button>
                  )}
                </StateRow>
              ) : rows.length === 0 ? (
                <StateRow colSpan={columns.length}>
                  <Inbox className="size-8 text-muted-foreground/50" />
                  <p className="font-medium">{search ? "No matches" : emptyTitle}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {search
                      ? `Nothing matches "${search}". Try a different search.`
                      : emptyDescription}
                  </p>
                  {!search && emptyAction}
                </StateRow>
              ) : (
                rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-secondary/50",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3",
                          alignClass(column.align),
                          hideClass(column.hideBelow),
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showFooter && (
          <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="iconSm"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 text-xs tabular-nums text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="iconSm"
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => onPageChange?.(page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StateRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16">
        <div className="flex flex-col items-center gap-2.5 text-center">{children}</div>
      </td>
    </tr>
  );
}

function SortIndicator({ active, order }: { active: boolean; order: "asc" | "desc" }) {
  return (
    <span
      aria-hidden
      className={cn("text-[0.625rem] leading-none", active ? "opacity-100" : "opacity-30")}
    >
      {active && order === "asc" ? "▲" : "▼"}
    </span>
  );
}

function alignClass(align: Column<unknown>["align"]) {
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
}

function hideClass(hideBelow: Column<unknown>["hideBelow"]) {
  return hideBelow === "sm"
    ? "hidden sm:table-cell"
    : hideBelow === "md"
      ? "hidden md:table-cell"
      : hideBelow === "lg"
        ? "hidden lg:table-cell"
        : undefined;
}
