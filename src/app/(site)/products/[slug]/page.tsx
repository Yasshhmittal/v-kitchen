import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { ProductCard } from "@/components/site/product-card";
import { ProductDetail } from "@/components/site/product-detail";
import { prisma } from "@/lib/prisma";
import { toProductView } from "@/server/services/mappers";
import { truncate } from "@/lib/format";

export const revalidate = 300;

/** Pre-render the catalogue at build time; new products fall back to SSR. */
export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true },
    take: 100,
  });
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { name: true, description: true, images: true },
  });

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.description ? truncate(product.description, 160) : undefined,
    openGraph: product.images[0]
      ? { images: [{ url: product.images[0] }], title: product.name }
      : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { category: { select: { name: true, slug: true } }, variants: true },
  });

  if (!product) notFound();

  const related = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 4,
    include: { category: { select: { name: true } }, variants: true },
  });

  return (
    <div className="section-shell py-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li>
            <Link href="/products" className="hover:text-foreground">
              Laddus &amp; Namkeens
            </Link>
          </li>
          {product.category && (
            <>
              <ChevronRight className="size-3.5" aria-hidden />
              <li>
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="hover:text-foreground"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="font-medium text-foreground">
            {product.name}
          </li>
        </ol>
      </nav>

      <ProductDetail product={toProductView(product, { includeLongDescription: true })} />

      {related.length > 0 && (
        <section className="mt-16 border-t pt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight">You might also like</h2>
          <div className="mt-7 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={toProductView(item)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
