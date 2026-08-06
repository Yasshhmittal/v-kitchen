"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CalendarDays, Clock, Loader2, MapPin, ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import { useCart } from "@/hooks/use-cart";
import { useCurrency, useSiteConfig } from "@/hooks/use-site-config";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatTime24to12 } from "@/lib/format";
import { orderCreateSchema } from "@/server/validation/schemas";
import type { PickupSlotView } from "@/types/view";

/**
 * Checkout.
 *
 * Two rules shape this whole component. First, the browser never sends a
 * price — the form posts item IDs and quantities, and the figures shown are
 * fetched back from `/api/orders/quote`, so what you see is what the server
 * will charge. Second, pickup slots are re-fetched whenever the date changes,
 * because capacity and the notice cut-off are both date-dependent.
 */

const formSchema = orderCreateSchema.omit({ items: true });
type FormValues = {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  pickupDate: string;
  pickupSlotId?: string;
  pickupTime?: string;
  notes?: string;
  couponCode?: string;
};

interface QuoteLine {
  name: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  minOrderValue: number;
  belowMinimum: boolean;
}

interface SlotResponse {
  slots: PickupSlotView[];
  min: string;
  max: string;
}

export function CheckoutForm({
  defaults,
  pickupNote,
}: {
  defaults: { name: string; phone: string; email: string } | null;
  pickupNote: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const currency = useCurrency();
  const { orderingEnabled, pausedMessage, address } = useSiteConfig();
  const { lines, isReady, clear } = useCart();

  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [slotData, setSlotData] = React.useState<SlotResponse | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactName: defaults?.name ?? "",
      contactPhone: defaults?.phone ?? "",
      contactEmail: defaults?.email ?? "",
      pickupDate: todayInput(),
      pickupSlotId: "",
      pickupTime: "",
      notes: "",
      couponCode: "",
    },
  });

  const pickupDate = watch("pickupDate");
  const pickupSlotId = watch("pickupSlotId");

  // Re-price against the database. Runs once the cart has hydrated, and again
  // if the customer edits the cart in another tab and comes back.
  const cartSignature = lines.map((line) => `${line.key}x${line.quantity}`).join("|");

  React.useEffect(() => {
    if (!isReady || lines.length === 0) return;

    let cancelled = false;
    setQuoteError(null);

    api
      .post<Quote>("/api/orders/quote", {
        items: lines.map((line) => ({
          kind: line.kind,
          itemId: line.itemId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      })
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(
          error instanceof ApiClientError
            ? error.message
            : "We couldn't check your cart just now. Please try again.",
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, cartSignature]);

  // Slots depend on the chosen date — a window that has already closed today
  // is still perfectly bookable tomorrow.
  React.useEffect(() => {
    if (!pickupDate) return;

    let cancelled = false;
    api
      .get<SlotResponse>(`/api/pickup-slots?date=${encodeURIComponent(pickupDate)}`)
      .then((result) => {
        if (cancelled) return;
        setSlotData(result);
        // Drop a selection that is no longer offered for the new date.
        const stillValid = result.slots.some(
          (slot) => slot.id === pickupSlotId && slot.available,
        );
        if (!stillValid) setValue("pickupSlotId", "");
      })
      .catch(() => {
        if (!cancelled) setSlotData(null);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupDate]);

  async function onSubmit(values: FormValues) {
    if (lines.length === 0) return;

    setSubmitting(true);
    try {
      const order = await api.post<{
        orderNo: string;
        total: string;
        pickupDate: string;
        itemCount: number;
      }>("/api/orders", {
        ...values,
        contactEmail: values.contactEmail || undefined,
        pickupSlotId: values.pickupSlotId || undefined,
        pickupTime: values.pickupTime || undefined,
        notes: values.notes || undefined,
        couponCode: values.couponCode || undefined,
        items: lines.map((line) => ({
          kind: line.kind,
          itemId: line.itemId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      });

      // Hand the confirmation page what it needs without a second lookup —
      // and without putting an order number in a shareable URL.
      sessionStorage.setItem(
        "vk.lastOrder",
        JSON.stringify({
          orderNo: order.orderNo,
          total: order.total,
          pickupDate: order.pickupDate,
          itemCount: order.itemCount,
          contactName: values.contactName,
          contactPhone: values.contactPhone,
          pickupWindow: selectedSlotLabel(slotData?.slots, values.pickupSlotId, values.pickupTime),
        }),
      );

      clear();
      router.push("/checkout/confirmation");
    } catch (error) {
      if (error instanceof ApiClientError) {
        // Field-level messages land on the right input; everything else is a
        // toast, since it usually means an item sold out mid-checkout.
        if (error.fields) {
          for (const [field, message] of Object.entries(error.fields)) {
            setError(field as keyof FormValues, { message });
          }
        }
        toast({ tone: "error", title: "Couldn't place your order", description: error.message });
      } else {
        toast({
          tone: "error",
          title: "Couldn't place your order",
          description: "Please check your connection and try again.",
        });
      }
      setSubmitting(false);
    }
  }

  if (!isReady) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="There's nothing to check out"
        description="Add something from the menu and come back."
        action={{ label: "Browse the menu", href: "/menu" }}
      />
    );
  }

  const slots = slotData?.slots ?? [];
  const hasSlots = slots.length > 0;
  const subtotal = quote?.subtotal ?? 0;
  const blocked = !orderingEnabled || Boolean(quote?.belowMinimum) || Boolean(quoteError);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-6">
        {/* ---- Contact ---- */}
        <Card className="p-6">
          <h2 className="font-semibold">Your details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll use these to confirm your order and let you know it&apos;s ready.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="contactName" error={errors.contactName?.message} required>
              <Input
                id="contactName"
                autoComplete="name"
                aria-invalid={Boolean(errors.contactName)}
                {...register("contactName")}
              />
            </Field>

            <Field
              label="Phone number"
              htmlFor="contactPhone"
              error={errors.contactPhone?.message}
              help="We'll call this number if there's a problem."
              required
            >
              <Input
                id="contactPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(errors.contactPhone)}
                {...register("contactPhone")}
              />
            </Field>

            <Field
              label="Email"
              htmlFor="contactEmail"
              error={errors.contactEmail?.message}
              help="Optional."
              className="sm:col-span-2"
            >
              <Input
                id="contactEmail"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.contactEmail)}
                {...register("contactEmail")}
              />
            </Field>
          </div>
        </Card>

        {/* ---- Pickup ---- */}
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="font-semibold">Pickup details</h2>
              {address && <p className="mt-1 text-sm text-muted-foreground">{address}</p>}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Pickup date"
              htmlFor="pickupDate"
              error={errors.pickupDate?.message}
              required
            >
              <Input
                id="pickupDate"
                type="date"
                min={slotData?.min}
                max={slotData?.max}
                aria-invalid={Boolean(errors.pickupDate)}
                {...register("pickupDate")}
              />
            </Field>

            {!hasSlots && (
              <Field
                label="Preferred time"
                htmlFor="pickupTime"
                error={errors.pickupTime?.message}
                help="Roughly when you'd like to collect."
              >
                <Input id="pickupTime" type="time" {...register("pickupTime")} />
              </Field>
            )}
          </div>

          {hasSlots && (
            <fieldset className="mt-5">
              <legend className="flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4 text-muted-foreground" aria-hidden />
                Choose a collection window
              </legend>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {slots.map((slot) => (
                  <label
                    key={slot.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                      !slot.available && "cursor-not-allowed opacity-50",
                      pickupSlotId === slot.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <input
                      type="radio"
                      value={slot.id}
                      disabled={!slot.available}
                      className="mt-1 size-4 accent-[hsl(var(--primary))]"
                      {...register("pickupSlotId")}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{slot.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatTime24to12(slot.startTime)} – {formatTime24to12(slot.endTime)}
                      </span>
                      {!slot.available ? (
                        <span className="mt-1 block text-xs font-medium text-destructive">
                          Not available
                        </span>
                      ) : slot.remaining !== null && slot.remaining <= 3 ? (
                        <span className="mt-1 block text-xs font-medium text-warning-foreground dark:text-warning">
                          Only {slot.remaining} left
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>

              {errors.pickupSlotId && (
                <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                  {errors.pickupSlotId.message}
                </p>
              )}
            </fieldset>
          )}

          <div className="mt-5">
            <Field
              label="Anything we should know?"
              htmlFor="notes"
              error={errors.notes?.message}
              help="Allergies, spice level, or a note for the kitchen."
            >
              <Textarea id="notes" rows={3} {...register("notes")} />
            </Field>
          </div>

          {pickupNote && (
            <p className="mt-5 flex gap-2 rounded-xl bg-secondary/70 p-3.5 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
              {pickupNote}
            </p>
          )}
        </Card>
      </div>

      {/* ---- Summary ---- */}
      <Card className="p-6 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>

        {quoteError ? (
          <p className="mt-4 flex gap-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {quoteError}
          </p>
        ) : !quote ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Pricing your order" />
          </div>
        ) : (
          <>
            <ul className="mt-5 space-y-3">
              {quote.lines.map((line, index) => (
                <li key={`${line.name}-${index}`} className="flex items-center gap-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {line.image ? (
                      <Image src={line.image} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-muted-foreground">
                        <ShoppingBag className="size-4" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.variantLabel ? `${line.variantLabel} · ` : ""}
                      {line.quantity} × {currency(line.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {currency(line.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-3 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium tabular-nums">{currency(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Collection</dt>
                <dd className="font-medium text-success">Free — pickup only</dd>
              </div>
              <div className="flex justify-between border-t pt-3 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-bold tabular-nums">{currency(subtotal)}</dd>
              </div>
            </dl>

            {quote.belowMinimum && (
              <p className="mt-4 rounded-xl bg-warning/15 p-3 text-sm text-warning-foreground dark:text-warning">
                Minimum order is {currency(quote.minOrderValue)}.{" "}
                <Link href="/menu" className="font-semibold underline underline-offset-2">
                  Add a little more
                </Link>{" "}
                to continue.
              </p>
            )}
          </>
        )}

        <div className="mt-5">
          <Field label="Coupon code" htmlFor="couponCode" error={errors.couponCode?.message}>
            <Input id="couponCode" placeholder="Optional" className="uppercase" {...register("couponCode")} />
          </Field>
        </div>

        {!orderingEnabled && pausedMessage && (
          <p className="mt-4 rounded-xl bg-warning/15 p-3 text-sm text-warning-foreground dark:text-warning">
            {pausedMessage}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting || blocked}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitting ? "Placing your order…" : "Place order"}
        </Button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pay when you collect. No card details needed.
        </p>
      </Card>
    </form>
  );
}

/** Local `yyyy-MM-dd`. `toISOString()` would shift the day in +0530. */
function todayInput(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function selectedSlotLabel(
  slots: PickupSlotView[] | undefined,
  slotId: string | undefined,
  fallbackTime: string | undefined,
): string | null {
  const slot = slots?.find((candidate) => candidate.id === slotId);
  if (slot) return `${formatTime24to12(slot.startTime)} – ${formatTime24to12(slot.endTime)}`;
  return fallbackTime ? formatTime24to12(fallbackTime) : null;
}
