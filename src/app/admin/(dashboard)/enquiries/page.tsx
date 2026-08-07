"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, IndianRupee, Phone, User } from "lucide-react";
import type { RequestStatus } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

import { api, queryString } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import {
  OCCASION_META,
  REQUEST_STATUS_FLOW,
  REQUEST_STATUS_META,
  PAGE_SIZE,
} from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EnquiryDetailDrawer } from "@/components/admin/enquiry-detail-drawer";
import type { RequestKind, RequestRow } from "@/server/services/request.service";

/**
 * The enquiry inbox. Bulk and custom requests are separate tables but one job,
 * so they share a screen: read what was asked, quote a figure, move it along.
 */
export default function EnquiriesPage() {
  const searchParams = useSearchParams();

  const [kind, setKind] = useState<RequestKind>(
    searchParams.get("kind") === "CUSTOM" ? "CUSTOM" : "BULK",
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>();
  const [openId, setOpenId] = useState<string | null>(searchParams.get("id"));
  const [page, setPage] = useState(1);

  // A notification deep link changes only the query string, which re-renders
  // this page without remounting it — so the initial state above would go
  // stale. Sync on every change instead.
  const deepLinkKind = searchParams.get("kind");
  const deepLinkId = searchParams.get("id");
  useEffect(() => {
    if (deepLinkKind === "BULK" || deepLinkKind === "CUSTOM") setKind(deepLinkKind);
    if (deepLinkId) setOpenId(deepLinkId);
  }, [deepLinkKind, deepLinkId]);

  const debouncedSearch = useDebounce(search, 300);

  const listQuery = useQuery({
    queryKey: ["admin", "enquiries", { kind, search: debouncedSearch, status: statusFilter, page }],
    queryFn: () =>
      api.getFull<RequestRow[]>(
        `/api/admin/enquiries${queryString({
          kind,
          search: debouncedSearch,
          status: statusFilter,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
  });

  const meta = listQuery.data?.meta as {
    total?: number;
    counts?: Record<RequestStatus, number>;
  };
  const counts = meta?.counts;

  const columns: Column<RequestRow>[] = [
    {
      key: "requestNo",
      header: "Enquiry",
      width: "w-36",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{row.requestNo}</p>
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
      key: "name",
      header: "From",
      width: "w-44",
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm">
            <User className="size-3.5 shrink-0 text-muted-foreground" />
            {row.name}
          </p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Phone className="size-3 shrink-0" />
            {row.phone}
          </p>
        </div>
      ),
    },
    {
      key: "about",
      header: kind === "BULK" ? "Occasion" : "Dish",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">
            {row.kind === "BULK"
              ? row.occasion === "OTHER" && row.occasionOther
                ? row.occasionOther
                : row.occasion
                  ? OCCASION_META[row.occasion].label
                  : "—"
              : (row.itemName ?? "—")}
          </p>
          {row.peopleCount !== null && (
            <p className="text-xs text-muted-foreground">{row.peopleCount} people</p>
          )}
        </div>
      ),
    },
    {
      key: "preferredDate",
      header: "Wanted for",
      width: "w-32",
      hideBelow: "md",
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-sm">
          {row.preferredDate ? (
            <>
              <Calendar className="size-3.5 text-muted-foreground" />
              {new Date(row.preferredDate).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              })}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No date</span>
          )}
        </span>
      ),
    },
    {
      key: "money",
      header: "Budget / quote",
      width: "w-36",
      align: "right",
      hideBelow: "lg",
      // Their budget and our quote answer different questions, and the gap
      // between them is the thing worth seeing at a glance.
      cell: (row) => (
        <div className="text-sm">
          {row.quotedAmount !== null ? (
            <p className="font-medium tabular-nums">{formatCurrency(row.quotedAmount)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Not quoted</p>
          )}
          {row.budget !== null && (
            <p className="flex items-center justify-end gap-0.5 text-xs text-muted-foreground">
              <IndianRupee className="size-3" />
              {formatCurrency(row.budget)} asked
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-32",
      align: "center",
      cell: (row) => {
        const statusMeta = REQUEST_STATUS_META[row.status];
        return <Badge variant={statusMeta.tone}>{statusMeta.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk orders and custom requests. Read, quote, and reply.
        </p>
      </div>

      <Tabs
        value={kind}
        onValueChange={(value) => {
          setKind(value as RequestKind);
          setStatusFilter(undefined);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="BULK">Bulk orders</TabsTrigger>
          <TabsTrigger value="CUSTOM">Custom orders</TabsTrigger>
        </TabsList>
      </Tabs>

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
        </Button>
        {REQUEST_STATUS_FLOW.map((status) => {
          const statusMeta = REQUEST_STATUS_META[status];
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
              {statusMeta.label}
              {counts && <span className="ml-1.5 text-xs opacity-60">{counts[status]}</span>}
            </Button>
          );
        })}
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
        searchPlaceholder="Search by reference, name, or phone…"
        page={page}
        pageSize={PAGE_SIZE}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        emptyTitle={
          statusFilter
            ? "Nothing in this status"
            : kind === "BULK"
              ? "No bulk enquiries yet"
              : "No custom requests yet"
        }
        emptyDescription={
          statusFilter
            ? "Enquiries will appear here as you move them along."
            : "Enquiries sent from the site will land here."
        }
      />

      <EnquiryDetailDrawer
        kind={kind}
        enquiryId={openId}
        open={Boolean(openId)}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </div>
  );
}
