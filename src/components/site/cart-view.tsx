"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";

import { QuantityStepper } from "@/components/site/cart-sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import { useCurrency, useSiteConfig } from "@/hooks/use-site-config";
import { CardGridSkeleton } from "@/components/shared/skeletons";

/**
 * Full cart page — the same lines as the sheet, with room to review.
 *
 * The subtotal here is indicative: the server re-prices every line when the
 * order is placed, so a price the owner changed while the cart sat open is
 * picked up at checkout rather than honoured from localStorage.
 */
export function CartView() {
  const { lines, count, subtotal, increment, decrement, remove, clear, isReady } = useCart();
  const currency = useCurrency();
  const { minOrderValue, orderingEnabled, pausedMessage } = useSiteConfig();

  if (!isReady) return <CardGridSkeleton count={3} />;

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add something from today's menu or grab a box of laddus to take home."
        action={{ label: "Browse the menu", href: "/menu" }}
      />
    );
  }

  const belowMinimum = minOrderValue > 0 && subtotal < minOrderValue;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div>
        <ul className="space-y-4">
          {lines.map((line) => (
            <li key={line.key}>
              <Card className="flex gap-4 p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-24">
                  {line.image ? (
                    <Image src={line.image} alt="" fill sizes="96px" className="object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <ShoppingBag className="size-6" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{line.name}</p>
                      {line.variantLabel && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{line.variantLabel}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {currency(line.unitPrice)} each
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums">
                      {currency(line.unitPrice * line.quantity)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <QuantityStepper
                      quantity={line.quantity}
                      onIncrement={() => increment(line.key)}
                      onDecrement={() => decrement(line.key)}
                      atMax={line.maxQuantity ? line.quantity >= line.maxQuantity : false}
                      label={line.name}
                      size="md"
                    />
                    <button
                      type="button"
                      onClick={() => remove(line.key)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Remove
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link href="/menu">Continue shopping</Link>
          </Button>
          <button
            type="button"
            onClick={clear}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
          >
            Clear cart
          </button>
        </div>
      </div>

      <Card className="p-6 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Items ({count})
            </dt>
            <dd className="font-medium tabular-nums">{currency(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Collection</dt>
            <dd className="font-medium text-success">Free — pickup only</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base">
            <dt className="font-semibold">Subtotal</dt>
            <dd className="font-bold tabular-nums">{currency(subtotal)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">
          Discounts and the final total are confirmed at checkout.
        </p>

        {belowMinimum && (
          <p className="mt-4 rounded-xl bg-warning/15 p-3 text-sm text-warning-foreground dark:text-warning">
            Minimum order is {currency(minOrderValue)}. Add {currency(minOrderValue - subtotal)} more
            to check out.
          </p>
        )}

        {!orderingEnabled && pausedMessage && (
          <p className="mt-4 rounded-xl bg-warning/15 p-3 text-sm text-warning-foreground dark:text-warning">
            {pausedMessage}
          </p>
        )}

        <Button
          asChild={orderingEnabled && !belowMinimum}
          size="lg"
          className="mt-6 w-full"
          disabled={!orderingEnabled || belowMinimum}
        >
          {orderingEnabled && !belowMinimum ? (
            <Link href="/checkout">
              Checkout
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span>Checkout</span>
          )}
        </Button>
      </Card>
    </div>
  );
}
