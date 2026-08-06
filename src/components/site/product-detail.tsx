"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Cookie, Minus, Plus, ShoppingBag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast";
import { useCart } from "@/hooks/use-cart";
import { useCurrency, useSiteConfig } from "@/hooks/use-site-config";
import { cn } from "@/lib/cn";
import type { ProductView } from "@/types/view";

/**
 * Interactive half of the product page: gallery, size picker, quantity and add
 * to cart. The variant decides the price, so this has to be client-side.
 */
export function ProductDetail({ product }: { product: ProductView }) {
  const currency = useCurrency();
  const { orderingEnabled } = useSiteConfig();
  const { add } = useCart();
  const { toast } = useToast();

  const [imageIndex, setImageIndex] = React.useState(0);
  const [variantId, setVariantId] = React.useState(
    () => product.variants.find((variant) => variant.inStock)?.id ?? product.variants[0]?.id,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const variant = product.variants.find((candidate) => candidate.id === variantId);
  const price = variant?.price ?? product.price;
  const compareAt = variant?.compareAtPrice ?? product.compareAtPrice;
  const stockQty = variant ? variant.stockQty : product.stockQty;
  const inStock = variant ? variant.inStock : product.inStock;
  const maxQuantity = stockQty && stockQty > 0 ? stockQty : undefined;

  const blocked = !inStock || !orderingEnabled;

  function onAdd() {
    if (blocked) return;
    add({
      kind: "PRODUCT",
      itemId: product.id,
      variantId: variant?.id,
      name: product.name,
      variantLabel: variant?.label,
      image: product.images[0] ?? null,
      unitPrice: price,
      quantity,
      maxQuantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    toast({
      tone: "success",
      title: `${product.name} added`,
      description: `${quantity} × ${variant?.label ?? product.weightLabel ?? "pack"}`,
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
      {/* Gallery */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-secondary">
          {product.images[imageIndex] ? (
            <Image
              src={product.images[imageIndex]}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <Cookie className="size-16" aria-hidden />
            </div>
          )}
        </div>

        {product.images.length > 1 && (
          <ul className="mt-4 grid grid-cols-5 gap-3">
            {product.images.map((image, index) => (
              <li key={image}>
                <button
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`View image ${index + 1}`}
                  aria-current={index === imageIndex}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors",
                    index === imageIndex ? "border-primary" : "border-transparent hover:border-border",
                  )}
                >
                  <Image src={image} alt="" fill sizes="20vw" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Details */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {product.categoryName && <Badge variant="secondary">{product.categoryName}</Badge>}
          {product.isVeg && <Badge variant="success">Veg</Badge>}
          {!inStock && <Badge variant="danger">Sold out</Badge>}
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {product.name}
        </h1>

        {product.description && (
          <p className="mt-3 text-pretty text-muted-foreground">{product.description}</p>
        )}

        <div className="mt-6 flex items-baseline gap-3">
          <span className="text-3xl font-bold text-primary">{currency(price)}</span>
          {compareAt && (
            <span className="text-lg text-muted-foreground line-through">{currency(compareAt)}</span>
          )}
          {compareAt && (
            <Badge variant="accent">
              {Math.round(((compareAt - price) / compareAt) * 100)}% off
            </Badge>
          )}
        </div>

        {product.variants.length > 0 && (
          <fieldset className="mt-7">
            <legend className="text-sm font-semibold">Choose a size</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.inStock}
                  onClick={() => {
                    setVariantId(option.id);
                    setQuantity(1);
                  }}
                  aria-pressed={option.id === variantId}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    option.id === variantId
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {option.inStock ? currency(option.price) : "Sold out"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {stockQty !== null && stockQty > 0 && stockQty <= 5 && (
          <p className="mt-4 text-sm font-medium text-warning-foreground dark:text-warning">
            Only {stockQty} left in stock.
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-border">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-10 text-center font-semibold tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuantity((current) => Math.min(maxQuantity ?? 99, current + 1))
              }
              disabled={maxQuantity ? quantity >= maxQuantity : false}
              className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <Button
            size="lg"
            onClick={onAdd}
            disabled={blocked}
            className={cn("flex-1 sm:flex-none", added && "bg-success hover:bg-success")}
          >
            {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
            {added
              ? "Added to cart"
              : !orderingEnabled
                ? "Ordering paused"
                : inStock
                  ? `Add ${currency(price * quantity)}`
                  : "Sold out"}
          </Button>
        </div>

        {product.longDescription && (
          <div className="mt-10 border-t pt-8">
            <h2 className="font-semibold">About this product</h2>
            <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
              {product.longDescription}
            </p>
          </div>
        )}

        {product.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
