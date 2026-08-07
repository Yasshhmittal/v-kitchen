"use client";

import * as React from "react";
import { Plus, ShieldCheck, UserX } from "lucide-react";
import type { Role } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiClientError } from "@/lib/api-client";
import { ROLE_PERMISSIONS } from "@/server/auth/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/toast";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CrudForm, type FieldDef } from "@/components/admin/crud-form";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { userCreateSchema, userUpdateSchema } from "@/server/validation/schemas";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_META: Record<Role, { label: string; blurb: string; tone: "default" | "info" | "neutral" }> = {
  OWNER: { label: "Owner", blurb: "Everything, including settings and staff", tone: "default" },
  MANAGER: { label: "Manager", blurb: "Menus, products, orders and enquiries", tone: "info" },
  STAFF: { label: "Staff", blurb: "Orders only — can't change prices", tone: "neutral" },
};

const ROLE_OPTIONS = (Object.keys(ROLE_META) as Role[]).map((role) => ({
  value: role,
  label: `${ROLE_META[role].label} — ${ROLE_META[role].blurb}`,
}));

type UserFormValues = {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: Role;
  isActive: boolean;
};

export function UsersScreen({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffUser | null>(null);
  const [deactivating, setDeactivating] = React.useState<StaffUser | null>(null);

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<StaffUser[]>("/api/admin/users"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const createMutation = useMutation({
    mutationFn: (input: unknown) => api.post<StaffUser>("/api/admin/users", input),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Staff account created", tone: "success" });
    },
    onError: (err) => {
      // Field errors are painted onto the form by CrudForm; anything else is
      // a surprise worth a toast.
      if (!(err instanceof ApiClientError)) {
        toast({ title: "Couldn't create that account.", tone: "error" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      api.patch<StaffUser>(`/api/admin/users/${id}`, input),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Account updated", tone: "success" });
    },
    onError: (err) => {
      if (!(err instanceof ApiClientError)) {
        toast({ title: "Couldn't save that account.", tone: "error" });
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      invalidate();
      setDeactivating(null);
      toast({ title: "Account deactivated", tone: "success" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/users/${id}`, { isActive: true }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Account reactivated", tone: "success" });
    },
    onError: (err) =>
      toast({
        title: err instanceof Error ? err.message : "Couldn't reactivate that account.",
        tone: "error",
      }),
  });

  const columns: Column<StaffUser>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-medium">
            {row.name}
            {row.id === currentUserId && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">(you)</span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "w-28",
      cell: (row) => <Badge variant={ROLE_META[row.role].tone}>{ROLE_META[row.role].label}</Badge>,
    },
    {
      key: "permissions",
      header: "Can do",
      hideBelow: "lg",
      // The count is the honest answer to "what does this role actually get?"
      // without printing nineteen permission strings into a table cell.
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{ROLE_META[row.role].blurb}</span>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Last signed in",
      width: "w-36",
      align: "right",
      hideBelow: "md",
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="text-sm">
            {new Date(row.lastLoginAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Never</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-24",
      align: "center",
      cell: (row) => (
        <Badge variant={row.isActive ? "success" : "secondary"}>
          {row.isActive ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-12",
      align: "right",
      cell: (row) => {
        // Deactivating yourself locks you out mid-session; the server refuses
        // it too, but the button should never have been clickable.
        if (row.id === currentUserId) return null;
        return (
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={
              row.isActive ? `Deactivate ${row.name}` : `Reactivate ${row.name}`
            }
            disabled={reactivateMutation.isPending}
            onClick={(event) => {
              // The row opens the editor — this button must not also do that.
              event.stopPropagation();
              if (row.isActive) setDeactivating(row);
              else reactivateMutation.mutate(row.id);
            }}
          >
            {row.isActive ? (
              <UserX className="size-4 text-muted-foreground" />
            ) : (
              <ShieldCheck className="size-4 text-muted-foreground" />
            )}
          </Button>
        );
      },
    },
  ];

  const fields: FieldDef<UserFormValues>[] = [
    { name: "name", label: "Name", type: "text", required: true, placeholder: "Priya Sharma" },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "priya@example.com",
      help: "They sign in with this.",
    },
    { name: "phone", label: "Phone", type: "tel", placeholder: "9876543210" },
    {
      name: "password",
      label: editing ? "New password" : "Password",
      type: "password",
      required: !editing,
      help: editing
        ? "Leave blank to keep the current password. Changing it signs them out everywhere."
        : "At least 8 characters. Share it with them directly and ask them to change it.",
    },
    {
      name: "role",
      label: "Role",
      type: "select",
      required: true,
      options: ROLE_OPTIONS,
      full: true,
      help: `Staff can see ${ROLE_PERMISSIONS.STAFF.length} areas, managers ${ROLE_PERMISSIONS.MANAGER.length}, owners all ${ROLE_PERMISSIONS.OWNER.length}.`,
    },
    {
      name: "isActive",
      label: "Active",
      type: "switch",
      help: "A disabled account can't sign in, but stays attached to its past orders.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who can sign in to this dashboard, and how much of it they see.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add staff
        </Button>
      </div>

      <DataTable
        rows={users}
        columns={columns}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
        emptyTitle="No staff accounts"
        emptyDescription="Add an account for anyone who needs to take orders or update the menu."
      />

      <CrudForm<UserFormValues>
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "Add staff"}
        description={
          editing
            ? undefined
            : "They'll sign in at /admin with the email and password you set here."
        }
        fields={fields}
        // Editing validates against the update schema, where the password is
        // optional — an edit that doesn't touch it shouldn't demand one.
        schema={(editing ? userUpdateSchema : userCreateSchema) as never}
        defaultValues={
          editing
            ? {
                name: editing.name,
                email: editing.email,
                phone: editing.phone ?? "",
                password: "",
                role: editing.role,
                isActive: editing.isActive,
              }
            : {
                name: "",
                email: "",
                phone: "",
                password: "",
                role: "STAFF" as Role,
                isActive: true,
              }
        }
        onSubmit={async (values) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, input: values });
          } else {
            await createMutation.mutateAsync(values);
          }
        }}
        submitLabel={editing ? "Save changes" : "Create account"}
        columns={2}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate this account?"
        description={
          deactivating ? (
            <>
              <strong>{deactivating.name}</strong> will be signed out everywhere and won&rsquo;t be
              able to sign back in. Their past orders and activity stay on record, and you can
              reactivate them at any time.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Deactivate"
        onConfirm={async () => {
          if (!deactivating) return;
          await deactivateMutation.mutateAsync(deactivating.id);
        }}
      />
    </div>
  );
}
