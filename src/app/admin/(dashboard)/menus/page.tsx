"use client";

import { useState } from "react";
import { Plus, Copy, Calendar, Clock, Trash2 } from "lucide-react";
import type { Menu } from "@prisma/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, queryString, type PageMeta } from "@/lib/api-client";
import { MENU_SLOT_META } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/toast";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  MenuEditor,
  EMPTY_MENU,
  type MenuFormValues,
} from "@/components/admin/menu-editor";
import type { MenuInput } from "@/server/validation/schemas";
import type { MenuWithCounts, MenuWithEntries } from "@/server/services/menu.service";

const PAGE_SIZE = 20;

export default function MenusPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>();
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [deleting, setDeleting] = useState<MenuWithCounts | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // The row only carries counts, so opening the editor fetches the composition.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<MenuWithCounts | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const listQuery = useQuery({
    queryKey: ["admin", "menus", { search: debouncedSearch, page, sort, order }],
    queryFn: () =>
      api.getFull<MenuWithCounts[]>(
        `/api/admin/menus${queryString({
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
          sort,
          order,
        })}`,
      ),
  });

  const editingQuery = useQuery({
    queryKey: ["admin", "menus", editingId],
    queryFn: () => api.get<MenuWithEntries>(`/api/admin/menus/${editingId}`),
    enabled: Boolean(editingId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "menus"] });

  const saveMutation = useMutation({
    mutationFn: (values: MenuInput) =>
      editingId
        ? api.patch<Menu>(`/api/admin/menus/${editingId}`, values)
        : api.post<Menu>("/api/admin/menus", values),
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      setEditingId(null);
      toast({ title: editingId ? "Menu updated" : "Menu created", tone: "success" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (sourceMenuId: string) =>
      api.post<Menu>("/api/admin/menus/duplicate", { sourceMenuId }),
    onSuccess: (menu) => {
      invalidate();
      setDuplicating(null);
      // Copies are created as drafts, so say so — otherwise it looks like
      // nothing happened when the site doesn't change.
      toast({
        title: "Menu duplicated",
        description: `"${menu.title}" was created as a draft. Open it to review and publish.`,
        tone: "success",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/menus/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: "Menu deleted", tone: "success" });
    },
  });

  const columns: Column<MenuWithCounts>[] = [
    {
      key: "title",
      header: "Menu",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          {row.subtitle && (
            <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
          )}
        </div>
      ),
    },
    {
      key: "slot",
      header: "Slot",
      sortable: true,
      width: "w-32",
      cell: (row) => <span className="text-sm">{MENU_SLOT_META[row.slot].label}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      width: "w-36",
      hideBelow: "md",
      cell: (row) =>
        row.date ? (
          <span className="flex items-center gap-1.5 text-sm">
            <Calendar className="size-3.5 text-muted-foreground" />
            {new Date(row.date).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : row.dayOfWeek !== null ? (
          <span className="text-sm text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row.dayOfWeek]}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Recurring</span>
        ),
    },
    {
      key: "cutoff",
      header: "Cutoff",
      width: "w-24",
      align: "center",
      hideBelow: "lg",
      cell: (row) =>
        row.orderCutoffTime ? (
          <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {row.orderCutoffTime}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        ),
    },
    {
      key: "items",
      header: "Dishes",
      width: "w-20",
      align: "right",
      cell: (row) => <span className="tabular-nums text-sm">{row._count.entries}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-24",
      align: "center",
      cell: (row) => (
        <Badge variant={row.isActive ? "success" : "neutral"}>
          {row.isActive ? "Active" : "Draft"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-24",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={`Duplicate ${row.title}`}
            onClick={(event) => {
              // The row itself opens the editor — these must not also do that.
              event.stopPropagation();
              setDuplicating(row);
            }}
          >
            <Copy className="size-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={`Delete ${row.title}`}
            onClick={(event) => {
              event.stopPropagation();
              setDeleting(row);
            }}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ),
    },
  ];

  const meta = listQuery.data?.meta as PageMeta | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Time-of-day, special, and recurring menus. Compose them from your dish catalogue.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="size-4" />
          New menu
        </Button>
      </div>

      <DataTable
        rows={listQuery.data?.data ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        error={listQuery.error instanceof Error ? listQuery.error.message : undefined}
        onRetry={() => listQuery.refetch()}
        onRowClick={(row) => {
          // TODO: open editor
          toast({ title: `Open editor for ${row.title}`, tone: "info" });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search menus…"
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
        emptyTitle="No menus yet"
        emptyDescription="Create your first menu by picking dishes from the catalogue."
        emptyAction={
          <Button variant="outline" onClick={() => toast({ title: "Editor coming next", tone: "info" })}>
            <Plus className="size-4" />
            Create a menu
          </Button>
        }
      />

      {/* Mounting is keyed on the record so switching rows rebuilds the form
          state rather than carrying the previous menu's composition over. */}
      <MenuEditor
        key={editingId ?? "new"}
        open={editorOpen && (!editingId || Boolean(editingQuery.data))}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingId(null);
        }}
        title={editingQuery.data ? `Edit ${editingQuery.data.title}` : "New menu"}
        defaultValues={editingQuery.data ? toFormValues(editingQuery.data) : EMPTY_MENU}
        onSubmit={(values) => saveMutation.mutateAsync(values).then(() => undefined)}
        submitLabel={editingId ? "Save changes" : "Create menu"}
      />

      <ConfirmDialog
        open={Boolean(duplicating)}
        onOpenChange={(open) => !open && setDuplicating(null)}
        title="Duplicate this menu?"
        description={
          duplicating ? (
            <>
              A copy of <strong>{duplicating.title}</strong> will be created as a draft with the
              same {duplicating._count.entries} dish
              {duplicating._count.entries === 1 ? "" : "es"}. Nothing changes on the site until
              you publish it.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Duplicate"
        onConfirm={async () => {
          if (duplicating) await duplicateMutation.mutateAsync(duplicating.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this menu?"
        description={
          deleting ? (
            <>
              <strong>{deleting.title}</strong> and its {deleting._count.entries} dish
              {deleting._count.entries === 1 ? "" : "es"} will be removed. The dishes stay in
              your catalogue, and past orders keep their own snapshots.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete menu"
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

/** API row → form values. Dates arrive as ISO strings, entries with full items. */
function toFormValues(menu: MenuWithEntries): MenuFormValues {
  return {
    title: menu.title,
    subtitle: menu.subtitle ?? "",
    slot: menu.slot,
    // `yyyy-MM-dd` for the date input.
    date: menu.date ? new Date(menu.date).toISOString().split("T")[0] ?? "" : "",
    dayOfWeek: menu.dayOfWeek ?? undefined,
    bannerImage: menu.bannerImage ?? "",
    orderCutoffTime: menu.orderCutoffTime ?? "",
    // `yyyy-MM-ddTHH:mm` for datetime-local.
    publishAt: menu.publishAt
      ? new Date(menu.publishAt).toISOString().slice(0, 16)
      : "",
    isActive: menu.isActive,
    sortOrder: menu.sortOrder,
    entries: menu.entries.map((entry, index) => ({
      menuItemId: entry.menuItemId,
      priceOverride: entry.priceOverride ? Number(entry.priceOverride) : undefined,
      isAvailable: entry.isAvailable,
      sortOrder: index,
      item: {
        name: entry.menuItem.name,
        image: entry.menuItem.image,
        price: Number(entry.menuItem.price),
        isVeg: entry.menuItem.isVeg,
      },
    })),
  };
}
