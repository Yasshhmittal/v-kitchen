"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2, Package } from "lucide-react";
import type { Category, Product } from "@prisma/client";
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
import { productSchema, type ProductInput } from "@/server/validation/schemas";
import type { ProductWithCategory } from "@/server/services/product.service";

const PAGE_SIZE = 20;

/** Blank product, so "New" always opens a clean form. */
const EMPTY: ProductInput = {
  name: "",
  slug: "",
  description: "",
  longDescription: "",
  images: [],
  categoryId: undefined,
  price: 0,
  discountPrice: undefined,
  weightLabel: "",
  weightGrams: undefined,
  trackStock: false,
  stockQty: 0,
  isVeg: true,
  isActive: true,
  isFeatured: false,
  tags: [],
  sortOrder: 0,
  variants: [],
};

export default function ProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | undefined>();
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [editing, setEditing] = useState<ProductWithCategory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProductWithCategory | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const listQuery = useQuery({
    queryKey: ["admin", "products", { search: debouncedSearch, page, sort, order }],
    queryFn: () =>
      api.getFull<ProductWithCategory[]>(
        `/api/admin/products${queryString({
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
          sort,
          order,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });

  // The category picker needs the product-type categories only.
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", "PRODUCT"],
    queryFn: () => api.get<Category[]>("/api/admin/categories?type=PRODUCT"),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });

  const saveMutation = useMutation({
    mutationFn: (values: ProductInput) =>
      editing
        ? api.patch<Product>(`/api/admin/products/${editing.id}`, values)
        : api.post<Product>("/api/admin/products", values),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing ? "Product updated" : "Product added", tone: "success" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/products/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: "Product deleted", tone: "success" });
    },
  });

  const columns: Column<ProductWithCategory>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
            {row.images[0] ? (
              <Image src={row.images[0]} alt="" fill sizes="40px" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <Package className="size-4" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.weightLabel && (
              <p className="truncate text-xs text-muted-foreground">{row.weightLabel}</p>
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
      key: "stockQty",
      header: "Stock",
      sortable: true,
      width: "w-24",
      align: "right",
      hideBelow: "lg",
      cell: (row) =>
        // An untracked product is always orderable, so a number would mislead.
        row.trackStock ? (
          <span
            className={
              row.stockQty === 0
                ? "font-medium tabular-nums text-destructive"
                : "tabular-nums"
            }
          >
            {row.stockQty}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Untracked</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-28",
      align: "center",
      cell: (row) => (
        <div className="flex flex-wrap justify-center gap-1">
          <Badge variant={row.isActive ? "success" : "neutral"}>
            {row.isActive ? "Listed" : "Hidden"}
          </Badge>
          {row.trackStock && row.stockQty === 0 && (
            <Badge variant="danger">Out of stock</Badge>
          )}
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

  const fields: FieldDef<ProductInput>[] = [
    { name: "name", label: "Product name", type: "text", required: true, placeholder: "Besan Laddu" },
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
      label: "Short description",
      type: "textarea",
      rows: 2,
      full: true,
      help: "Shown on the product card",
    },
    {
      name: "longDescription",
      label: "Full description",
      type: "textarea",
      rows: 4,
      full: true,
      help: "Shown on the product page — ingredients, shelf life, anything worth saying",
    },
    {
      name: "images",
      label: "Photos",
      type: "image",
      multiple: true,
      folder: "products",
      full: true,
      help: "The first photo is the one customers see on the card",
    },
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
      name: "weightLabel",
      label: "Weight / size",
      type: "text",
      placeholder: "500g box",
      help: "How it's sold",
    },
    {
      name: "weightGrams",
      label: "Weight in grams",
      type: "number",
      min: 0,
      help: "Used for sorting and filters",
    },
    {
      name: "trackStock",
      label: "Track stock",
      type: "switch",
      help: "Turn on to count units and go out-of-stock automatically",
    },
    {
      name: "stockQty",
      label: "Units in stock",
      type: "number",
      min: 0,
      // Pointless unless stock is being counted.
      when: (values) => values.trackStock,
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
    { name: "isActive", label: "Listed", type: "switch", help: "Uncheck to hide from the site" },
    { name: "isVeg", label: "Vegetarian", type: "switch" },
    { name: "isFeatured", label: "Featured", type: "switch", help: "Shown on the home page" },
  ];

  const meta = listQuery.data?.meta as PageMeta | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Packaged goods customers can order any day — laddus, namkeens, festival boxes.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          New product
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
        searchPlaceholder="Search products…"
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
        emptyTitle="No products yet"
        emptyDescription="Add your first packaged product so customers can order it any day."
        emptyAction={
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add a product
          </Button>
        }
      />

      <CrudForm
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New product"}
        fields={fields}
        schema={productSchema}
        defaultValues={editing ? toFormValues(editing) : EMPTY}
        onSubmit={(values) => saveMutation.mutateAsync(values).then(() => undefined)}
        submitLabel={editing ? "Save changes" : "Add product"}
        columns={2}
        size="xl"
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this product?"
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
        confirmLabel="Delete product"
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

/** Prisma row -> form values. Decimals arrive as strings over JSON. */
function toFormValues(product: ProductWithCategory): ProductInput {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    longDescription: product.longDescription ?? "",
    images: product.images,
    categoryId: product.categoryId ?? undefined,
    price: Number(product.price),
    discountPrice: product.discountPrice === null ? undefined : Number(product.discountPrice),
    weightLabel: product.weightLabel ?? "",
    weightGrams: product.weightGrams ?? undefined,
    trackStock: product.trackStock,
    stockQty: product.stockQty,
    isVeg: product.isVeg,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    tags: product.tags,
    sortOrder: product.sortOrder,
    variants: [],
  };
}
