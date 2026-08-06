import type { Metadata } from "next";
import { Cookie } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { CategoryChips } from "@/components/site/category-chips";
import { PageHeader } from "@/components/site/page-header";
import { ProductCard } from "@/components/site/product-card";
import { prisma } from "@/lib/prisma";
import { toProductView } from "@/server/services/mappers";

/**
 * Packaged goods — laddus, namkeens, festival boxes. Categories drive the
 * filter chips, so adding a category in the admin adds a filter here.
 */

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Laddus & Namkeens",
  description: "Freshly made laddus and namkeens, packed and ready to collect.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const params = await searchParams;

  const orderBy =
    params.sort === "price-asc"
      ? [{ price: "asc" as const }]
      : params.sort === "price-desc"
        ? [{ price: "desc" as const }]
        : [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, type: "PRODUCT", products: { some: { isActive: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(params.category ? { category: { slug: params.category } } : {}),
      },
      orderBy,
      include: { category: { select: { name: true } }, variants: true },
    }),
  ]);

  const activeCategory = categories.find((category) => category.slug === params.category);

  return (
    <>
      <PageHeader
        eyebrow="Take something home"
        title={activeCategory?.name ?? "Laddus & Namkeens"}
        lead="Made in small batches with the same recipes we cook every day. Collect from the counter."
        tint="cream"
      >
        <CategoryChips
          categories={categories}
          activeSlug={params.category}
          basePath="/products"
          allLabel="Everything"
        />
      </PageHeader>

      <div className="section-shell py-10 lg:py-14">
        {products.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={toProductView(product)} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Cookie}
            title={activeCategory ? `Nothing in ${activeCategory.name} yet` : "Nothing here yet"}
            description="Check back soon — we restock regularly."
            action={activeCategory ? { label: "See everything", href: "/products" } : undefined}
          />
        )}
      </div>
    </>
  );
}
