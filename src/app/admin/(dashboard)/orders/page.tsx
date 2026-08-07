"use client";

import { useState } from "react";
import { Calendar, Package, Phone, User } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

import { api, queryString } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_META } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { OrderDetailDrawer } from "@/components/admin/order-detail-drawer";
import type { OrderListRow } from "@/server/services/order.service";

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>();
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebounce(search, 300);

  const listQuery = useQuery({
    queryKey: ["admin", "orders", { search: debouncedSearch, status: statusFilter, page, sort, order }],
    queryFn: () =>
      api.getFull<OrderListRow[]>(
        `/api/admin/orders${queryString({
          search: debouncedSearch,
          status: statusFilter,
          page,
          pageSize: PAGE_SIZE,
          sort,
          order,
        })}`,
      ),
  });

  const counts = (listQuery.data?.meta as { counts?: Record<OrderStatus, number> })?.counts ?? {
    PENDING: 0,
    ACCEPTED: 0,
    PREPARING: 0,
    READY_FOR_PICKUP: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };

  const columns: Column<OrderListRow>[] = [
    {
      key: "orderNo",
      header: "Order",
      sortable: true,
      width: "w-36",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{row.orderNo}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      width: "w-48",
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm">
            <User className="size-3.5 shrink-0 text-muted-foreground" />
            {row.contactName}
          </p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Phone className="size-3 shrink-0" />
            {row.contactPhone}
          </p>
        </div>
      ),
    },
    {
      key: "pickupDate",
      header: "Pickup",
      sortable: true,
      width: "w-36",
      hideBelow: "md",
      cell: (row) => (
        <div className="text-sm">
          <p className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            {new Date(row.pickupDate).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
            })}
          </p>
          {row.pickupSlot && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.pickupSlot.startTime}–{row.pickupSlot.endTime}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      width: "w-20",
      align: "center",
      hideBelow: "lg",
      cell: (row) => (
        <span className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <Package className="size-3.5" />
          {row._count.items}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      width: "w-28",
      align: "right",
      cell: (row) => (
        <span className="font-medium tabular-nums">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "w-36",
      align: "center",
      cell: (row) => {
        const meta = ORDER_STATUS_META[row.status];
        return <Badge variant={meta.tone}>{meta.label}</Badge>;
      },
    },
  ];

  const meta = listQuery.data?.meta as { total?: number; page?: number; pageSize?: number };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track, accept, prepare and complete customer orders.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={statusFilter === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setStatusFilter(undefined);
            setPage(1);
          }}
        >
          All
          {listQuery.data && (
            <span className="ml-1.5 text-xs opacity-60">
              {Object.values(counts).reduce((sum, n) => sum + n, 0)}
            </span>
          )}
        </Button>
        {(["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP"] as OrderStatus[]).map(
          (status) => {
            const meta = ORDER_STATUS_META[status];
            return (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
              >
                {meta.label}
                {listQuery.data && (
                  <span className="ml-1.5 text-xs opacity-60">{counts[status]}</span>
                )}
              </Button>
            );
          },
        )}
      </div>

      <DataTable
        rows={listQuery.data?.data ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        error={listQuery.error instanceof Error ? listQuery.error.message : undefined}
        onRetry={() => listQuery.refetch()}
        onRowClick={(row) => {
          // TODO: open detail drawer
          console.log("Open order", row.orderNo);
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search orders by number, name, or phone…"
        sort={sort}
        order={order}
        onSortChange={(key, next) => {
          setSort(key);
          setOrder(next);
        }}
        page={page}
        pageSize={PAGE_SIZE}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        emptyTitle={statusFilter ? "No orders in this status" : "No orders yet"}
        emptyDescription={
          statusFilter
            ? "Orders will appear here once they move into this status."
            : "Orders placed through the site will appear here."
        }
      />
    </div>
  );
}
