"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_META } from "@/lib/constants";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/toast";

interface AccountOrderItem {
  id: string;
  menuItemId: string | null;
  productId: string | null;
  productVariantId: string | null;
  nameSnapshot: string;
  imageSnapshot: string | null;
  variantSnapshot: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

interface AccountOrder {
  id: string;
  orderNo: string;
  status: keyof typeof ORDER_STATUS_META;
  pickupDate: string;
  pickupTime: string | null;
  pickupSlot: { label: string } | null;
  total: string;
  createdAt: string;
  items: AccountOrderItem[];
}

export function AccountOrders() {
  const { add } = useCart();
  const { toast } = useToast();

  const ordersQuery = useQuery({
    queryKey: ["account", "orders"],
    queryFn: () => api.get<AccountOrder[]>("/api/account/orders"),
  });

  /**
   * Reorder.
   *
   * Lines whose dish or product has since been deleted are skipped and counted
   * rather than silently dropped — "3 of 4 items added" is the honest answer,
   * and the missing one is usually the reason someone rings up. Prices come
   * from the snapshot for display only; checkout re-prices from the database,
   * so a stale cart can never undercharge.
   */
  function reorder(order: AccountOrder) {
    let added = 0;
    for (const item of order.items) {
      const itemId = item.menuItemId ?? item.productId;
      if (!itemId) continue;

      add({
        kind: item.menuItemId ? "MENU_ITEM" : "PRODUCT",
        itemId,
        variantId: item.productVariantId ?? undefined,
        name: item.nameSnapshot,
        variantLabel: item.variantSnapshot ?? undefined,
        image: item.imageSnapshot,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
      });
      added += 1;
    }

    const missing = order.items.length - added;
    if (added === 0) {
      toast({
        title: "Nothing to reorder",
        description: "None of the items from this order are on the menu right now.",
        tone: "error",
      });
      return;
    }

    toast({
      title: missing === 0 ? "Added to your cart" : `${added} of ${order.items.length} items added`,
      description:
        missing === 0
          ? `${added} item${added === 1 ? "" : "s"} from ${order.orderNo}.`
          : "The rest aren't on the menu at the moment.",
      tone: "success",
    });
  }

  if (ordersQuery.isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ordersQuery.error) {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-6">
        <p className="text-sm">
          {ordersQuery.error instanceof Error
            ? ordersQuery.error.message
            : "We couldn't load your orders."}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => ordersQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const orders = ordersQuery.data ?? [];

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <h2 className="text-lg font-semibold">No orders yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Once you place an order it appears here, and reordering it is one tap.
        </p>
        <Button asChild className="mt-4">
          <Link href="/menu">See today&rsquo;s menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const statusMeta = ORDER_STATUS_META[order.status];
        return (
          <article key={order.id} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{order.orderNo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Collect{" "}
                  {new Date(order.pickupDate).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                  {order.pickupSlot ? ` · ${order.pickupSlot.label}` : ""}
                  {!order.pickupSlot && order.pickupTime ? ` · ${order.pickupTime}` : ""}
                </p>
              </div>
              <Badge variant={statusMeta.tone}>{statusMeta.label}</Badge>
            </div>

            <ul className="mt-4 space-y-1.5 border-t pt-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 text-sm">
                  <span className="min-w-0">
                    <span className="text-muted-foreground">{item.quantity}×</span>{" "}
                    {item.nameSnapshot}
                    {item.variantSnapshot && (
                      <span className="text-muted-foreground"> ({item.variantSnapshot})</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="font-semibold tabular-nums">{formatCurrency(order.total)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/track?orderNo=${order.orderNo}`}>Track</Link>
                </Button>
                <Button size="sm" onClick={() => reorder(order)}>
                  <RotateCcw className="size-4" />
                  Order again
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
