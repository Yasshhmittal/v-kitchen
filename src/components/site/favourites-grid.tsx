"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MenuCard } from "./menu-card";
import { ProductCard } from "./product-card";
import { useFavourites } from "@/hooks/use-favourites";
import type { MenuItemView, ProductView } from "@/types/view";

/**
 * The favourites grid.
 *
 * Server-rendered rows come in as props; the cards' own hearts do the unsaving.
 * This watches the shared favourites query so a card leaves the grid the moment
 * you tap it — including the heading above it and, once nothing is left, the
 * whole grid in favour of the empty state.
 *
 * While the query is still loading nothing is known to be favourited, so it
 * shows everything it was given rather than blanking for a moment.
 */
export function FavouritesGrid({
  menuItems,
  products,
}: {
  menuItems: MenuItemView[];
  products: ProductView[];
}) {
  const { isSignedIn, isFavourite } = useFavourites();

  const visibleMenuItems = isSignedIn
    ? menuItems.filter((item) => isFavourite({ menuItemId: item.id }))
    : menuItems;
  const visibleProducts = isSignedIn
    ? products.filter((product) => isFavourite({ productId: product.id }))
    : products;

  if (visibleMenuItems.length === 0 && visibleProducts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <h2 className="text-lg font-semibold">Nothing saved yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Tap the heart on any dish or product and it lands here for next time.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/menu">Browse the menu</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/products">Laddus &amp; namkeen</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {visibleMenuItems.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Dishes</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMenuItems.map((item) => (
              <MenuCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {visibleProducts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Laddus &amp; namkeen</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
