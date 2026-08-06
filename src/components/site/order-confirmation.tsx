"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, MapPin, Phone, Receipt, ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-site-config";
import { formatDate } from "@/lib/format";

/**
 * Order confirmation.
 *
 * The details come from sessionStorage, written by the checkout form a moment
 * ago — deliberately not from a lookup by order number in the URL, because a
 * URL like `/confirmation?order=VK-260806-0004` would let anyone read the
 * previous customer's order by decrementing the number. Refreshing keeps
 * working; opening the page cold shows the tracking form instead.
 */

interface StoredOrder {
  orderNo: string;
  total: string;
  pickupDate: string;
  itemCount: number;
  contactName: string;
  contactPhone: string;
  pickupWindow: string | null;
}

export function OrderConfirmation({
  pickupNote,
  address,
  phone,
}: {
  pickupNote: string;
  address: string;
  phone: string;
}) {
  const currency = useCurrency();
  const [order, setOrder] = React.useState<StoredOrder | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem("vk.lastOrder");
      if (stored) setOrder(JSON.parse(stored) as StoredOrder);
    } catch {
      // Nothing stored, or storage unavailable — fall through to the empty state.
    }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="h-64" aria-hidden />;

  if (!order) {
    return (
      <EmptyState
        icon={Receipt}
        title="No recent order to show"
        description="If you've already ordered, look it up with your order number and phone number."
        action={{ label: "Track an order", href: "/track" }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-full bg-success/15">
          <CheckCircle2 className="size-8 text-success" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Order placed, {firstName(order.contactName)}</h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          We&apos;ve got it. We&apos;ll call you on {order.contactPhone} if anything needs checking.
        </p>
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/50 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Order number</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{order.orderNo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pay on collection</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{currency(order.total)}</p>
          </div>
        </div>

        <dl className="divide-y">
          <Row icon={CalendarDays} label="Pickup date">
            {formatDate(order.pickupDate)}
          </Row>
          {order.pickupWindow && (
            <Row icon={Clock} label="Collection window">
              {order.pickupWindow}
            </Row>
          )}
          <Row icon={ShoppingBag} label="Items">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </Row>
          {address && (
            <Row icon={MapPin} label="Collect from">
              {address}
            </Row>
          )}
          {phone && (
            <Row icon={Phone} label="Our number">
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="underline underline-offset-2">
                {phone}
              </a>
            </Row>
          )}
        </dl>
      </Card>

      {pickupNote && (
        <p className="mt-5 rounded-xl bg-secondary/70 p-4 text-sm text-muted-foreground">{pickupNote}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href={`/track?orderNo=${encodeURIComponent(order.orderNo)}`}>Track this order</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/menu">Order something else</Link>
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Keep your order number handy — you&apos;ll need it along with your phone number to check
        progress.
      </p>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="w-32 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
