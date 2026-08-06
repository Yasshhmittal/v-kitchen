"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Horizontal category filter chips. Real links again, so a filtered view can
 * be shared and indexed.
 */
export function CategoryChips({
  categories,
  activeSlug,
  basePath,
  allLabel = "All",
}: {
  categories: Array<{ slug: string; name: string }>;
  activeSlug?: string;
  basePath: string;
  allLabel?: string;
}) {
  if (categories.length === 0) return null;

  const chip = (active: boolean) =>
    cn(
      "inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
    );

  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-2">
        <li>
          <Link href={basePath} className={chip(!activeSlug)}>
            {allLabel}
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`${basePath}?category=${category.slug}`}
              aria-current={activeSlug === category.slug ? "page" : undefined}
              className={chip(activeSlug === category.slug)}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
