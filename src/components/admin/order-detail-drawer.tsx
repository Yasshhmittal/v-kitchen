"use client";

import * as React from "react";
import Image from "next/image";
import { Calendar, Clock, Package, Phone, User, Mail, FileText } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_META, ORDER_STATUS_TRANSITIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { Dialog, SheetContent } from "@/components/ui/overlays";
import { useToast } from "@/components/shared/toast";
import type { OrderDetail } from "@/server/services/order.service";

export function OrderDetailDrawer({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cancelling asks for a reason inline — a browser prompt() blocks the page
  // and the reason is shown to the customer, so it's worth a real field.
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin", "orders", orderId],
    queryFn: () => api.get<OrderDetail>(`/api/admin/orders/${orderId}`),
    enabled: Boolean(orderId),
  });

  // Reopening for another order must not inherit the last one's cancel form.
  React.useEffect(() => {
    setCancelling(false);
    setCancelReason("");
    setActionError(null);
  }, [orderId]);

  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: OrderStatus; reason?: string }) =>
      api.patch(`/api/admin/orders/${orderId}/status`, { status, cancelReason: reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setCancelling(false);
      setCancelReason("");
      setActionError(null);
      toast({
        title: `Order ${ORDER_STATUS_META[variables.status].label.toLowerCase()}`,
        tone: "success",
      });
    },
    // The server refuses illegal transitions with a specific message; showing
    // it in place beats a toast that disappears before it's read.
    onError: (error) =>
      setActionError(error instanceof Error ? error.message : "Couldn't update the status."),
  });

  const order = detailQuery.data;
  if (!order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading order…</p>
          </div>
        </SheetContent>
      </Dialog>
    );
  }

  const meta = ORDER_STATUS_META[order.status];
  const nextStatuses = ORDER_STATUS_TRANSITIONS[order.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-lg font-semibold">{order.orderNo}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {new Date(order.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Badge variant={meta.tone}>{meta.label}</Badge>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 space-y-6 overflow-y-auto py-6">
            {/* Customer */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Customer
              </h3>
              <div className="space-y-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground" />
                  {order.contactName}
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground" />
                  <a href={`tel:${order.contactPhone}`} className="hover:underline">
                    {order.contactPhone}
                  </a>
                </p>
                {order.contactEmail && (
                  <p className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <a href={`mailto:${order.contactEmail}`} className="hover:underline">
                      {order.contactEmail}
                    </a>
                  </p>
                )}
              </div>
            </section>

            {/* Pickup */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pickup
              </h3>
              <div className="space-y-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  {new Date(order.pickupDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {order.pickupSlot ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-muted-foreground" />
                    {order.pickupSlot.label} ({order.pickupSlot.startTime}–
                    {order.pickupSlot.endTime})
                  </p>
                ) : order.pickupTime ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-muted-foreground" />
                    Around {order.pickupTime}
                  </p>
                ) : null}
              </div>
            </section>

            {/* Items */}
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Items
              </h3>
              <ul className="space-y-3">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {item.imageSnapshot ? (
                        <Image
                          src={item.imageSnapshot}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center">
                          <Package className="size-5 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.nameSnapshot}</p>
                      {item.variantSnapshot && (
                        <p className="text-xs text-muted-foreground">{item.variantSnapshot}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Total */}
            <section>
              <div className="space-y-2 rounded-xl border bg-secondary/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Discount {order.couponCode && `(${order.couponCode})`}
                    </span>
                    <span className="tabular-nums text-success">
                      −{formatCurrency(order.discount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </section>

            {/* Notes */}
            {(order.notes || order.adminNotes) && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </h3>
                <div className="space-y-3">
                  {order.notes && (
                    <div className="rounded-xl border p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="size-3" />
                        Customer note
                      </p>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  )}
                  {order.adminNotes && (
                    <div className="rounded-xl border bg-secondary/30 p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Kitchen note
                      </p>
                      <p className="text-sm">{order.adminNotes}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {order.cancelReason && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Cancellation
                </h3>
                <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-3">
                  <p className="text-sm">{order.cancelReason}</p>
                </div>
              </section>
            )}
          </div>

          {/* Footer — status actions */}
          {nextStatuses.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Move to
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((status) => {
                  const targetMeta = ORDER_STATUS_META[status];
                  return (
                    <Button
                      key={status}
                      variant={status === "CANCELLED" ? "destructive" : "default"}
                      size="sm"
                      disabled={statusMutation.isPending}
                      onClick={() => {
                        if (status === "CANCELLED") {
                          const reason = prompt(
                            "Reason for cancellation (shown to the customer):",
                          );
                          if (reason) statusMutation.mutate({ status, reason });
                        } else {
                          statusMutation.mutate({ status });
                        }
                      }}
                    >
                      {targetMeta.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Dialog>
  );
}
