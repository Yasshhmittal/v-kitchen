"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/overlays";
import { useCart } from "@/hooks/use-cart";
import { useCurrency } from "@/hooks/use-site-config";
import { cn } from "@/lib/cn";

/**
 * The slide-in cart. Prices shown here are the snapshot taken when the item
 * was added; the server re-prices everything at checkout, so this is a
 * preview, not the invoice.
 */
export function CartSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lines, count, subtotal, increment, decrement, remove, clear } = useCart();
  const currency = useCurrency();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby={undefined}>
        <header className="flex shrink-0 items-center gap-2 border-b px-5 py-4 pr-14">
          <ShoppingBag className="size-5 text-primary" aria-hidden />
          <DialogPrimitive.Title className="text-base font-semibold">
            Your order
          </DialogPrimitive.Title>
          {count > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {count} {count === 1 ? "item" : "items"}
            </span>
          )}
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-secondary">
              <ShoppingBag className="size-7 text-muted-foreground" aria-hidden />
            </div>
            <p className="font-semibold">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">
              Add something from today&apos;s menu and it will show up here.
            </p>
            <Button asChild className="mt-2" onClick={() => onOpenChange(false)}>
              <Link href="/menu">Browse the menu</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-3">
                {lines.map((line) => (
                  <li key={line.key} className="flex gap-3 rounded-xl border border-border/70 p-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {line.image ? (
                        <Image
                          src={line.image}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-muted-foreground">
                          <ShoppingBag className="size-5" aria-hidden />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{line.name}</p>
                      {line.variantLabel && (
                        <p className="text-xs text-muted-foreground">{line.variantLabel}</p>
                      )}
                      <p className="mt-0.5 text-sm font-semibold text-primary">
                        {currency(line.unitPrice)}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <QuantityStepper
                          quantity={line.quantity}
                          onDecrement={() => decrement(line.key)}
                          onIncrement={() => increment(line.key)}
                          atMax={line.maxQuantity ? line.quantity >= line.maxQuantity : false}
                          label={line.name}
                        />
                        <button
                          type="button"
                          onClick={() => remove(line.key)}
                          className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {currency(line.unitPrice * line.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={clear}
                className="mt-4 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
              >
                Clear cart
              </button>
            </div>

            <footer className="shrink-0 space-y-3 border-t px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-lg font-bold tabular-nums">{currency(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pickup only — choose your collection date and time at checkout.
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  <Link href="/cart">View cart</Link>
                </Button>
                <Button asChild className="flex-1" onClick={() => onOpenChange(false)}>
                  <Link href="/checkout">Checkout</Link>
                </Button>
              </div>
            </footer>
          </>
        )}
      </SheetContent>
    </DialogPrimitive.Root>
  );
}

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  atMax,
  label,
  size = "sm",
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  atMax?: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  const buttonSize = size === "sm" ? "size-7" : "size-9";
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-background">
      <button
        type="button"
        onClick={onDecrement}
        className={cn(
          buttonSize,
          "grid place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={`Decrease quantity of ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <span
        className={cn(
          "min-w-7 text-center text-sm font-semibold tabular-nums",
          size === "md" && "min-w-9",
        )}
        aria-live="polite"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={atMax}
        className={cn(
          buttonSize,
          "grid place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent",
        )}
        aria-label={`Increase quantity of ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
