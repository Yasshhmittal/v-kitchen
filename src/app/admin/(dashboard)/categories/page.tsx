"use client";

import { useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import type { Category, CategoryType } from "@prisma/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/toast";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudForm, type FieldDef } from "@/components/admin/crud-form";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { categorySchema } from "@/server/validation/schemas";
import type { CategoryWithCounts } from "@/server/services/category.service";

const TYPE_LABELS: Record<CategoryType, string> = {
  MENU: "Menu",
  PRODUCT: "Product",
};

export default function CategoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithCounts | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCounts | null>(null);

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => api.get<CategoryWithCounts[]>("/api/admin/categories"),
  });

  const createMutation = useMutation({
    mutationFn: (input: unknown) => api.post<Category>("/api/admin/categories", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      setDialogOpen(false);
      toast({ title: "Category created" });
    },
    onError: (err) => {
      if (!(err instanceof ApiClientError)) {
        toast({ title: "Failed to create category", tone: "error" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      api.patch<Category>(`/api/admin/categories/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      setDialogOpen(false);
      toast({ title: "Category updated" });
    },
    onError: (err) => {
      if (!(err instanceof ApiClientError)) {
        toast({ title: "Failed to update category", tone: "error" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      setDeleting(null);
      toast({ title: "Category deleted" });
    },
  });

  const columns: Column<CategoryWithCounts>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.icon && <span className="text-lg">{row.icon}</span>}
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: "w-28",
      cell: (row) => (
        <Badge variant={row.type === "MENU" ? "default" : "secondary"}>
          {TYPE_LABELS[row.type]}
        </Badge>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      width: "w-40",
      hideBelow: "md",
      cell: (row) => <code className="text-xs text-muted-foreground">{row.slug}</code>,
    },
    {
      key: "items",
      header: "Items",
      width: "w-24",
      align: "right",
      hideBelow: "sm",
      cell: (row) => (
        <span className="tabular-nums">
          {row._count.menuItems + row._count.products}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-24",
      align: "center",
      cell: (row) => (
        <Badge variant={row.isActive ? "success" : "secondary"}>
          {row.isActive ? "Active" : "Hidden"}
        </Badge>
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
            // The row itself opens the editor — deleting must not also do that.
            event.stopPropagation();
            setDeleting(row);
          }}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  const fields: FieldDef<typeof categorySchema._type>[] = [
    { name: "name", label: "Name", type: "text", required: true, placeholder: "Starters" },
    {
      name: "slug",
      label: "URL slug",
      type: "text",
      help: "Leave blank to generate from the name",
      placeholder: "starters",
    },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "MENU", label: "Menu items" },
        { value: "PRODUCT", label: "Products (laddus, namkeen)" },
      ],
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      rows: 3,
      help: "Optional — shown on the category page",
    },
    { name: "image", label: "Image", type: "image", folder: "categories" },
    {
      name: "icon",
      label: "Icon emoji",
      type: "text",
      placeholder: "🍜",
      help: "Single emoji shown in filter chips",
    },
    {
      name: "tintColor",
      label: "Tint color",
      type: "text",
      placeholder: "#2E7D32",
      help: "Hex code — used for the category card accent",
    },
    {
      name: "sortOrder",
      label: "Sort order",
      type: "number",
      min: 0,
      help: "Lower numbers appear first",
    },
    { name: "isActive", label: "Active", type: "switch", help: "Hidden categories don't appear on the site" },
    { name: "isFeatured", label: "Featured", type: "switch", help: "Show on the home page" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize menu items and products. Drag to reorder.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      <DataTable
        rows={categories}
        columns={columns}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error instanceof Error ? error.message : undefined}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
        emptyTitle="No categories yet"
        emptyDescription="Categories let you organize menu items and products. Create one to get started."
        emptyAction={
          <Button
            variant="outline"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Tag className="size-4" />
            Create your first category
          </Button>
        }
      />

      <CrudForm
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Edit category" : "New category"}
        fields={fields}
        schema={categorySchema}
        defaultValues={
          editing
            ? {
                name: editing.name,
                slug: editing.slug,
                type: editing.type,
                description: editing.description || "",
                image: editing.image || "",
                icon: editing.icon || "",
                tintColor: editing.tintColor || "",
                sortOrder: editing.sortOrder,
                isActive: editing.isActive,
                isFeatured: editing.isFeatured,
              }
            : {
                name: "",
                slug: "",
                type: "MENU" as CategoryType,
                description: "",
                image: "",
                icon: "",
                tintColor: "",
                sortOrder: 0,
                isActive: true,
                isFeatured: false,
              }
        }
        onSubmit={async (values) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, input: values });
          } else {
            await createMutation.mutateAsync(values);
          }
        }}
        submitLabel={editing ? "Save changes" : "Create category"}
        columns={2}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete category?"
        description={
          deleting ? (
            <>
              <strong>{deleting.name}</strong> will be permanently removed. Menu items and
              products in this category will lose their category assignment.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete category"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteMutation.mutateAsync(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
