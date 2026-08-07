"use client";

import * as React from "react";
import { Ban, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { Dialog, SheetContent } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/shared/toast";
import type { CustomerDetail } from "@/server/services/customer.service";

/** `passwordHash` is stripped server-side, so the client type must reflect that. */
type CustomerDetailSafe = Omit<CustomerDetail, "passwordHash">;

export function CustomerDetailDrawer({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [note, setNote] = React.useState("");
  const [confirmBlock, setConfirmBlock] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin", "customers", customerId],
    queryFn: () => api.get<CustomerDetailSafe>(`/api/admin/customers/${customerId}`),
    enabled: Boolean(customerId),
  });

  const customer = detailQuery.data;

  // Seed the note field from the record once it loads, and reset when the
  // drawer switches to a different customer.
  React.useEffect(() => {
    setNote(customer?.addressNote ?? "");
    setConfirmBlock(false);
  }, [customer?.id, customer?.addressNote]);

  const mutation = useMutation({
    mutationFn: (patch: { isBlocked?: boolean; addressNote?: string }) =>
      api.patch(`/api/admin/customers/${customerId}`, patch),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      setConfirmBlock(false);
      toast({
        title:
          variables.isBlocked === undefined
            ? "Note saved"
            : variables.isBlocked
              ? "Customer blocked"
              : "Customer unblocked",
        tone: "success",
      });
    },
    onError: (error) =>
      toast({
        title: error instanceof Error ? error.message : "Couldn't save that.",
        tone: "error",
      }),
  });

  const completed = customer?.orders.filter((order) => order.status === "COMPLETED") ?? [];
  const totalSpent = completed.reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {!customer ? (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-sm text-muted-foreground">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Loading customer…"}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b px-6 pb-4 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{customer.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Since{" "}
                    {new Date(customer.createdAt).toLocaleDateString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {customer.isBlocked && <Badge variant="danger">Blocked</Badge>}
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <section className="grid grid-cols-3 gap-3">
                <Stat label="Orders" value={String(customer.orders.length)} />
                <Stat label="Completed" value={String(completed.length)} />
                <Stat label="Spent" value={formatCurrency(totalSpent)} />
              </section>

              <section>
                <SectionTitle>Contact</SectionTitle>
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="flex items-center gap-2 text-sm">
                    <User className="size-4 text-muted-foreground" />
                    {customer.name}
                  </p>
                  <p className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-muted-foreground" />
                    <a href={`tel:${customer.phone}`} className="hover:underline">
                      {customer.phone}
                    </a>
                  </p>
                  {customer.email && (
                    <p className="flex items-center gap-2 text-sm">
                      <Mail className="size-4 text-muted-foreground" />
                      <a href={`mailto:${customer.email}`} className="hover:underline">
                        {customer.email}
                      </a>
                    </p>
                  )}
                </div>
              </section>

              <section>
                <Field
                  label="Kitchen note"
                  htmlFor="customer-note"
                  help="Allergies, preferences, anything worth remembering. Not shown to the customer."
                >
                  <Textarea
                    id="customer-note"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. no peanuts, always calls before collecting"
                  />
                </Field>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={mutation.isPending || note === (customer.addressNote ?? "")}
                  onClick={() => mutation.mutate({ addressNote: note })}
                >
                  Save note
                </Button>
              </section>

              <section>
                <SectionTitle>Recent orders</SectionTitle>
                {customer.orders.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No orders yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {customer.orders.map((order) => {
                      const statusMeta = ORDER_STATUS_META[order.status];
                      return (
                        <li
                          key={order.id}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-medium">{order.orderNo}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              {" · "}
                              {order.items.length} item{order.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={statusMeta.tone}>{statusMeta.label}</Badge>
                            <span className="text-sm font-medium tabular-nums">
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="border-t px-6 pb-6 pt-4">
              <Button
                variant={customer.isBlocked ? "outline" : "destructive"}
                size="sm"
                disabled={mutation.isPending}
                onClick={() =>
                  customer.isBlocked
                    ? mutation.mutate({ isBlocked: false })
                    : setConfirmBlock(true)
                }
              >
                {customer.isBlocked ? (
                  <>
                    <ShieldCheck className="size-4" />
                    Unblock customer
                  </>
                ) : (
                  <>
                    <Ban className="size-4" />
                    Block customer
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>

      </Dialog>

      {/* Sibling of the sheet, not a child — a Radix dialog nested inside
          another traps focus in the wrong layer when both are open. */}
      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={`Block ${customer?.name ?? "this customer"}?`}
        description="They won't be able to sign in or place new orders. Their existing orders are untouched, and you can unblock them at any time."
        confirmLabel="Block"
        onConfirm={async () => {
          await mutation.mutateAsync({ isBlocked: true });
        }}
      />
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

