"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { Category, MenuItem } from "@prisma/client";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";

import { api, queryString, type PageMeta } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/toast";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudForm, type FieldDef } from "@/components/admin/crud-form";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { menuItemSchema, type MenuItemInput } from "@/server/validation/schemas";
import type { MenuItemWithCategory } from "@/server/services/menu-item.service";

const PAGE_SIZE = 20;

/** Blank dish, so "New" always opens a clean form. */
const EMPTY: MenuItemInput = {
  name: "",
  slug: "",
  description: "",
  image: "",
  categoryId: undefined,
  price: 0,
  discountPrice: undefined,
  unitLabel: "",
  isAvailable: true,
  prepTimeMins: 20,
  isVeg: true,
  isSpecial: false,
  isFeatured: false,
  tags: [],
  sortOrder: 0,
};

export default function MenuItemsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>();
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [editing, setEditing] = useState<MenuItemWithCategory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<MenuItemWithCategory | null>(null);

  // Searching on every keystroke would fire a request per letter.
  const debouncedSearch = useDebounce(search, 300);

  const listQuery = useQuery({
    queryKey: ["admin", "menu-items", { search: debouncedSearch, page, sort, order }],
    queryFn: () =>
      api.getFull<MenuItemWithCategory[]>(
        `/api/admin/menu-items${queryString({
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
          sort,
          order,
        })}`,
      ),
    // Keeps the previous page on screen while the next one loads, instead of
    // flashing an empty table.
    placeholderData: keepPreviousData,
  });

  // The category picker needs the menu-type categories only.
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", "MENU"],
    queryFn: () => api.get<Category[]>("/api/admin/categories?type=MENU"),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "menu-items"] });

  const saveMutation = useMutation({
    mutationFn: (values: MenuItemInput) =>
      editing
        ? api.patch<MenuItem>(`/api/admin/menu-items/${editing.id}`, values)
        : api.post<MenuItem>("/api/admin/menu-items", values),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing ? "Dish updated" : "Dish added", tone: "success" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/menu-items/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: "Dish deleted", tone: "success" });
    },
  });

  const columns: Column<MenuItemWithCategory>[] = [
    {
      key: "name",
      header: "Dish",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
            {row.image ? (
              <Image src={row.image} alt="" fill sizes="40px" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <UtensilsCrossed className="size-4" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.unitLabel && (
              <p className="truncate text-xs text-muted-foreground">{row.unitLabel}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      width: "w-40",
      hideBelow: "md",
      cell: (row) =>
        row.category ? (
          <span className="text-muted-foreground">{row.category.name}</span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        ),
    },
    {
      key: "price",
      header: "Price",
      sortable: true,
      width: "w-32",
      align: "right",
      cell: (row) =>
        row.discountPrice ? (
          <span className="tabular-nums">
            <span className="font-medium">{formatCurrency(row.discountPrice)}</span>{" "}
            <s className="text-xs text-muted-foreground">{formatCurrency(row.price)}</s>
          </span>
        ) : (
          <span className="font-medium tabular-nums">{formatCurrency(row.price)}</span>
        ),
    },
    {
      key: "menus",
      header: "On menus",
      width: "w-24",
      align: "right",
      hideBelow: "lg",
      cell: (row) => <span className="tabular-nums">{row._count.entries}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-28",
      align: "center",
      cell: (row) => (
        <div className="flex flex-wrap justify-center gap-1">
          <Badge variant={row.isAvailable ? "success" : "neutral"}>
            {row.isAvailable ? "Available" : "Hidden"}
          </Badge>
          {row.isSpecial && <Badge variant="accent">Special</Badge>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-12",
      align: "right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={`Delete ${row.name}`}
          onClick={(event) => {
            // The row click opens the editor — deleting must not also do that.
            event.stopPropagation();
            setDeleting(row);
          }}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  const fields: FieldDef<MenuItemInput>[] = [
    { name: "name", label: "Dish name", type: "text", required: true, placeholder: "Paneer Butter Masala" },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      options: (categoriesQuery.data ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
      placeholder: "Uncategorised",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      rows: 3,
      full: true,
      help: "Shown under the dish name on the menu",
    },
    { name: "image", label: "Photo", type: "image", folder: "menu-items", full: true },
    { name: "price", label: "Price", type: "number", required: true, min: 0, step: 1 },
    {
      name: "discountPrice",
      label: "Offer price",
      type: "number",
      min: 0,
      step: 1,
      help: "Leave blank for no offer",
    },
    {
      name: "unitLabel",
      label: "Unit",
      type: "text",
      placeholder: "per plate",
      help: "How it's sold, e.g. per plate, 250g",
    },
    {
      name: "prepTimeMins",
      label: "Prep time (minutes)",
      type: "number",
      min: 0,
      max: 1440,
    },
    {
      name: "tags",
      label: "Tags",
      type: "tags",
      full: true,
      help: "Press Enter or comma after each tag",
    },
    { name: "sortOrder", label: "Sort order", type: "number", min: 0, help: "Lower shows first" },
    { name: "slug", label: "URL slug", type: "text", help: "Leave blank to generate from the name" },
    { name: "isAvailable", label: "Available", type: "switch", help: "Uncheck to hide from the site" },
    { name: "isVeg", label: "Vegetarian", type: "switch" },
    { name: "isSpecial", label: "Special", type: "switch", help: "Flagged on the specials page" },
    { name: "isFeatured", label: "Featured", type: "switch", help: "Shown on the home page" },
  ];

  const meta = listQuery.data?.meta as PageMeta | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dishes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your catalogue of dishes. Add them to a menu to make them orderable.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          New dish
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
          setEditing(row);
          setDialogOpen(true);
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1); // A new search invalidates the page you were on.
        }}
        searchPlaceholder="Search dishes…"
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
        emptyTitle="No dishes yet"
        emptyDescription="Add your first dish, then put it on a menu so customers can order it."
        emptyAction={
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add a dish
          </Button>
        }
      />

      <CrudForm
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New dish"}
        fields={fields}
        schema={menuItemSchema}
        defaultValues={editing ? toFormValues(editing) : EMPTY}
        onSubmit={(values) => saveMutation.mutateAsync(values).then(() => undefined)}
        submitLabel={editing ? "Save changes" : "Add dish"}
        columns={2}
        size="xl"
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this dish?"
        description={
          deleting ? (
            <>
              <strong>{deleting.name}</strong> will be removed from your catalogue. Past orders
              keep their own copy of the name and price, so they won&apos;t change.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete dish"
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

/** Prisma row -> form values. Decimals arrive as strings over JSON. */
function toFormValues(item: MenuItemWithCategory): MenuItemInput {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    image: item.image ?? "",
    categoryId: item.categoryId ?? undefined,
    price: Number(item.price),
    discountPrice: item.discountPrice === null ? undefined : Number(item.discountPrice),
    unitLabel: item.unitLabel ?? "",
    isAvailable: item.isAvailable,
    prepTimeMins: item.prepTimeMins,
    isVeg: item.isVeg,
    isSpecial: item.isSpecial,
    isFeatured: item.isFeatured,
    tags: item.tags,
    sortOrder: item.sortOrder,
  };
}
