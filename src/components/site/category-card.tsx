import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { CARD_TINTS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { CategoryView } from "@/types/view";

/**
 * Tinted category card with the circular arrow button, matching the reference
 * layout. The tint is the owner's `tintColor` when set, otherwise the palette
 * rotates by position so a fresh install still looks deliberate.
 */
export function CategoryCard({
  category,
  href,
  index = 0,
  className,
}: {
  category: CategoryView;
  href: string;
  index?: number;
  className?: string;
}) {
  const tint = category.tintColor || CARD_TINTS[index % CARD_TINTS.length] || CARD_TINTS[0];
  // Owner-set tints are raw values (#hex, hsl(...)); the fallbacks are var()
  // references that must be wrapped to resolve.
  const background = tint.startsWith("var(") ? `hsl(${tint})` : tint;

  return (
    <Link
      href={href}
      style={{ backgroundColor: background }}
      className={cn(
        "group relative flex min-h-[15rem] flex-col justify-between overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          width={220}
          height={220}
          className="pointer-events-none absolute -bottom-6 -right-6 size-40 rotate-[-8deg] object-contain opacity-90 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-0 sm:size-48"
        />
      ) : (
        <DynamicIcon
          name={category.icon}
          className="pointer-events-none absolute -bottom-4 -right-4 size-32 text-foreground/[0.06]"
        />
      )}

      <div className="relative">
        {category.icon && category.image && (
          <span className="mb-4 inline-grid size-10 place-items-center rounded-full bg-background/70">
            <DynamicIcon name={category.icon} className="size-5 text-primary" />
          </span>
        )}
        <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {category.name}
        </h3>
        {category.description && (
          <p className="mt-2 max-w-[18ch] text-sm text-foreground/70">{category.description}</p>
        )}
      </div>

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:rotate-45">
          <ArrowUpRight className="size-5" aria-hidden />
        </span>
        {category.itemCount > 0 && (
          <span className="text-sm font-medium text-foreground/60">
            {category.itemCount} {category.itemCount === 1 ? "item" : "items"}
          </span>
        )}
      </div>
    </Link>
  );
}
