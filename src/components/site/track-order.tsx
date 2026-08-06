"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  Clock,
  Loader2,
  MapPin,
  Search,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-site-config";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { ORDER_STATUS_META } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { orderLookupSchema } from "@/server/validation/schemas";
import type { OrderView } from "@/types/view";

/**
 * Order tracking.
 *
 * Order number *and* matching phone number, checked server-side. The order
 * number alone is guessable — they run in sequence — so it is never enough on
 * its own, and a wrong pair returns the same "not found" as a nonexistent
 * order so the form can't be used to test whether a number exists.
 */

type FormValues = { orderNo: string; phone: string };

/** The happy path, in order. Cancellation is handled separately. */
const TIMELINE: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "COMPLETED",
];

export function TrackOrder({ address }: { address: string }) {
  const searchParams = useSearchParams();
  const currency = useCurrency();

  const [order, setOrder] = React.useState<OrderView | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [searching, setSearching] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(orderLookupSchema),
    // The confirmation page links here with the number pre-filled; the phone
    // number is still typed by hand, so the link alone reveals nothing.
    defaultValues: { orderNo: searchParams.get("orderNo") ?? "", phone: "" },
  });

  async function onSubmit(values: FormValues) {
    setSearching(true);
    setNotFound(false);
    try {
      const result = await api.post<OrderView>("/api/orders/track", values);
      setOrder(result);
    } catch (error) {
      setOrder(null);
      setNotFound(error instanceof ApiClientError);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Order number" htmlFor="orderNo" error={errors.orderNo?.message} required>
            <Input
              id="orderNo"
              placeholder="VK-260806-0001"
              autoComplete="off"
              spellCheck={false}
              className="uppercase"
              aria-invalid={Boolean(errors.orderNo)}
              {...register("orderNo")}
            />
          </Field>

          <Field label="Phone number" htmlFor="phone" error={errors.phone?.message} required>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="The number you ordered with"
              aria-invalid={Boolean(errors.phone)}
              {...register("phone")}
            />
          </Field>

          <Button type="submit" disabled={searching} className="sm:mb-0.5">
            {searching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            {searching ? "Looking…" : "Find order"}
          </Button>
        </form>
      </Card>

      {notFound && (
        <p className="mt-5 rounded-xl bg-warning/15 p-4 text-sm text-warning-foreground dark:text-warning">
          We couldn&apos;t find an order with that number and phone number. Check both and try
          again — or{" "}
          <Link href="/contact" className="font-semibold underline underline-offset-2">
            get in touch
          </Link>{" "}
          and we&apos;ll look it up for you.
        </p>
      )}

      {order && <OrderDetail order={order} address={address} currency={currency} />}
    </div>
  );
}

function OrderDetail({
  order,
  address,
  currency,
}: {
  order: OrderView;
  address: string;
  currency: (value: number | string) => string;
}) {
  const cancelled = order.status === "CANCELLED";
  const currentStep = TIMELINE.indexOf(order.status);
  const meta = ORDER_STATUS_META[order.status];

  return (
    <div className="mt-8 space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/50 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{order.orderNo}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Placed {formatDateTime(order.placedAt)}
            </p>
          </div>
          <Badge variant={meta.tone === "neutral" ? "neutral" : meta.tone}>{meta.label}</Badge>
        </div>

        <div className="p-5">
          {cancelled ? (
            <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-4">
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-destructive">This order was cancelled</p>
                {order.cancelReason && (
                  <p className="mt-1 text-sm text-muted-foreground">{order.cancelReason}</p>
                )}
              </div>
            </div>
          ) : (
            <ol className="space-y-0">
              {TIMELINE.map((status, index) => {
                const done = index <= currentStep;
                const isCurrent = index === currentStep;
                const last = index === TIMELINE.length - 1;

                return (
                  <li key={status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : (
                          <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        )}
                      </span>
                      {!last && (
                        <span
                          className={cn(
                            "w-0.5 flex-1 transition-colors",
                            index < currentStep ? "bg-primary" : "bg-border",
                          )}
                        />
                      )}
                    </div>

                    <div className={cn("pb-6", last && "pb-0")}>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          isCurrent ? "text-primary" : done ? "" : "text-muted-foreground",
                        )}
                      >
                        {ORDER_STATUS_META[status].label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {STEP_COPY[status]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Collection</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="w-28 shrink-0 text-muted-foreground">Date</dt>
            <dd className="font-medium">{formatDate(order.pickupDate)}</dd>
          </div>
          {order.pickupWindow && (
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <dt className="w-28 shrink-0 text-muted-foreground">Time</dt>
              <dd className="font-medium">{order.pickupWindow}</dd>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <dt className="w-28 shrink-0 text-muted-foreground">Address</dt>
              <dd className="font-medium">{address}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">
          {order.items.length} {order.items.length === 1 ? "item" : "items"}
        </h2>

        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {item.image ? (
                  <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <ShoppingBag className="size-4" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantLabel ? `${item.variantLabel} · ` : ""}
                  {item.quantity} × {currency(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {currency(item.lineTotal)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{currency(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd className="tabular-nums">−{currency(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{currency(order.total)}</dd>
          </div>
        </dl>

        {order.notes && (
          <p className="mt-4 rounded-lg bg-secondary/70 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Your note: </span>
            {order.notes}
          </p>
        )}
      </Card>
    </div>
  );
}

const STEP_COPY: Record<OrderStatus, string> = {
  PENDING: "We've received your order and will confirm shortly.",
  ACCEPTED: "Confirmed — it's in the queue.",
  PREPARING: "Being made fresh in the kitchen.",
  READY_FOR_PICKUP: "Ready and waiting at the counter.",
  COMPLETED: "Collected. Thank you!",
  CANCELLED: "This order was cancelled.",
};
