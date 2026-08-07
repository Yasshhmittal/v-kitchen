"use client";

import { useState } from "react";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api, queryString } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CustomerDetailDrawer } from "@/components/admin/customer-detail-drawer";
import type { CustomerRow } from "@/server/services/customer.service";

type Filter = "all" | "registered" | "guests" | "blocked";

/**
 * The customer roll. Everyone who has ever ordered is here, whether they
 * registered or checked out as a guest — the two are the same person to the
 * kitchen, and the list says which is which rather than splitting them up.
 */
export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const listQuery = useQuery({
    queryKey: ["admin", "customers", { search: debouncedSearch, filter, page }],
    queryFn: () =>
      api.getFull<CustomerRow[]>(
        `/api/admin/customers${queryString({
          search: debouncedSearch,
          hasAccount:
            filter === "registered" ? "true" : filter === "guests" ? "false" : undefined,
          isBlocked: filter === "blocked" ? "true" : undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
  });

  const meta = listQuery.data?.meta as { total?: number };

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Customer",
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-medium">
            {row.name}
            {row.isBlocked && (
              <Badge variant="danger" className="shrink-0">
                Blocked
              </Badge>
            )}
          </p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Phone className="size-3 shrink-0" />
            {row.phone}
            {row.email && (
              <>
                <Mail className="ml-1.5 size-3 shrink-0" />
                <span className="truncate">{row.email}</span>
              </>
            )}
          </p>
        </div>
      ),
    },
    {
      key: "hasAccount",
      header: "Type",
      width: "w-28",
      align: "center",
      hideBelow: "md",
      // A guest is not a lesser customer — they just haven't set a password.
      cell: (row) =>
        row.hasAccount ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Registered
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Guest</span>
        ),
    },
    {
      key: "orderCount",
      header: "Orders",
      width: "w-20",
      align: "center",
      hideBelow: "lg",
      cell: (row) => <span className="text-sm tabular-nums">{row.orderCount}</span>,
    },
    {
      key: "totalSpent",
      header: "Spent",
      width: "w-28",
      align: "right",
      cell: (row) => (
        <span className="text-sm font-medium tabular-nums">{formatCurrency(row.totalSpent)}</span>
      ),
    },
    {
      key: "lastOrderAt",
      header: "Last order",
      width: "w-32",
      align: "right",
      hideBelow: "md",
      cell: (row) =>
        row.lastOrderAt ? (
          <span className="text-sm">
            {new Date(row.lastOrderAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Never</span>
        ),
    },
  ];

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "registered", label: "Registered" },
    { value: "guests", label: "Guests" },
    { value: "blocked", label: "Blocked" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who has ordered, and what they&rsquo;ve spent.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter(option.value);
              setPage(1);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <DataTable
        rows={listQuery.data?.data ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        error={listQuery.error instanceof Error ? listQuery.error.message : undefined}
        onRetry={() => listQuery.refetch()}
        onRowClick={(row) => setOpenId(row.id)}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by name, phone, or email…"
        page={page}
        pageSize={PAGE_SIZE}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        emptyTitle={filter === "all" ? "No customers yet" : "Nobody matches this filter"}
        emptyDescription={
          filter === "all"
            ? "Anyone who places an order will appear here, guest or registered."
            : "Try a different filter or clear the search."
        }
      />

      <CustomerDetailDrawer
        customerId={openId}
        open={Boolean(openId)}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </div>
  );
}
