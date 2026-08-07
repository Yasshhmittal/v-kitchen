"use client";

import Image from "next/image";
import { Clock, UtensilsCrossed } from "lucide-react";

import { AddToCartButton } from "./add-to-cart-button";
import { FavouriteButton } from "./favourite-button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/hooks/use-site-config";
import { cn } from "@/lib/cn";
import type { MenuItemView } from "@/types/view";

/**
 * One dish on the menu. `blocked` carries the reason ordering is unavailable
 * (past the cut-off, sold out) so the customer sees *why*, not just a dead
 * button.
 */
export function MenuCard({
  item,
  blockedReason,
  className,
}: {
  item: MenuItemView;
  blockedReason?: string;
  className?: string;
}) {
  const currency = useCurrency();
  const unavailable = !item.isAvailable;
  const reason = unavailable ? "Sold out" : blockedReason;

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
        unavailable && "opacity-70",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <UtensilsCrossed className="size-8" aria-hidden />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {item.isSpecial && <Badge variant="accent">Special</Badge>}
          {item.compareAtPrice && (
            <Badge variant="danger" className="bg-destructive text-destructive-foreground">
              {Math.round(((item.compareAtPrice - item.price) / item.compareAtPrice) * 100)}% off
            </Badge>
          )}
        </div>

        <FavouriteButton
          name={item.name}
          target={{ menuItemId: item.id }}
          className="absolute bottom-3 right-3"
        />

        {/* The green/red square Indian veg-mark. */}
        <span
          className={cn(
            "absolute right-3 top-3 grid size-5 place-items-center rounded-[0.25rem] border-2 bg-white",
            item.isVeg ? "border-success" : "border-destructive",
          )}
          title={item.isVeg ? "Vegetarian" : "Non-vegetarian"}
        >
          <span className="sr-only">{item.isVeg ? "Vegetarian" : "Non-vegetarian"}</span>
          <span
            className={cn("size-2 rounded-full", item.isVeg ? "bg-success" : "bg-destructive")}
            aria-hidden
          />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-tight">{item.name}</h3>

        {item.description && (
          <p className="mt-1.5 line-clamp-2-safe text-sm text-muted-foreground">
            {item.description}
          </p>
        )}

        {item.tags.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-primary">{currency(item.price)}</span>
              {item.compareAtPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {currency(item.compareAtPrice)}
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {item.unitLabel ? (
                <span>{item.unitLabel}</span>
              ) : (
                <>
                  <Clock className="size-3" aria-hidden />
                  {item.prepTimeMins} min
                </>
              )}
            </p>
          </div>

          <AddToCartButton
            item={{
              kind: "MENU_ITEM",
              itemId: item.id,
              name: item.name,
              image: item.image,
              unitPrice: item.price,
            }}
            disabled={Boolean(reason)}
            disabledReason={reason}
          />
        </div>
      </div>
    </article>
  );
}
