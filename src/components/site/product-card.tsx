"use client";

import Image from "next/image";
import Link from "next/link";
import { Cookie } from "lucide-react";

import { AddToCartButton } from "./add-to-cart-button";
import { FavouriteButton } from "./favourite-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/use-site-config";
import { cn } from "@/lib/cn";
import type { ProductView } from "@/types/view";

/**
 * A packaged product (laddu box, namkeen pack).
 *
 * Products with weight variants can't be added straight from the card — the
 * customer has to pick a size first, so the card links through to the detail
 * page instead of guessing for them.
 */
export function ProductCard({ product, className }: { product: ProductView; className?: string }) {
  const currency = useCurrency();
  const hasVariants = product.variants.length > 0;
  const soldOut = !product.inStock || (hasVariants && product.variants.every((v) => !v.inStock));
  const lowStock =
    !soldOut && product.stockQty !== null && product.stockQty > 0 && product.stockQty <= 5;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
        soldOut && "opacity-70",
        className,
      )}
    >
      <Link href={`/products/${product.slug}`} className="relative aspect-square overflow-hidden bg-secondary">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Cookie className="size-8" aria-hidden />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {soldOut && <Badge variant="danger">Sold out</Badge>}
          {!soldOut && lowStock && <Badge variant="warning">Only {product.stockQty} left</Badge>}
          {product.compareAtPrice && (
            <Badge variant="accent">
              {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
              off
            </Badge>
          )}
        </div>
      </Link>

      {/* Outside the <Link>, or saving would navigate to the product page. */}
      <FavouriteButton
        name={product.name}
        target={{ productId: product.id }}
        className="absolute right-3 top-3"
      />

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-tight">
          <Link href={`/products/${product.slug}`} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>

        {(product.weightLabel || hasVariants) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {hasVariants
              ? product.variants.map((variant) => variant.label).join(" · ")
              : product.weightLabel}
          </p>
        )}

        {product.description && (
          <p className="mt-1.5 line-clamp-2-safe text-sm text-muted-foreground">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="flex items-baseline gap-1.5">
            {hasVariants && <span className="text-xs text-muted-foreground">from</span>}
            <span className="text-lg font-bold text-primary">{currency(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-sm text-muted-foreground line-through">
                {currency(product.compareAtPrice)}
              </span>
            )}
          </div>

          {hasVariants ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/products/${product.slug}`}>Choose size</Link>
            </Button>
          ) : (
            <AddToCartButton
              item={{
                kind: "PRODUCT",
                itemId: product.id,
                name: product.name,
                image: product.images[0] ?? null,
                unitPrice: product.price,
                maxQuantity: product.stockQty ?? undefined,
              }}
              disabled={soldOut}
              disabledReason={soldOut ? "Sold out" : undefined}
            />
          )}
        </div>
      </div>
    </article>
  );
}
