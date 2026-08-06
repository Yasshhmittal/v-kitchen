import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Dark-green feature banner with the limited-time badge — the "today's
 * special" strip from the reference layout. Owner can hide it entirely with
 * the `home.feature.enabled` setting.
 */
export function FeatureBanner({
  badge,
  title,
  description,
  image,
  cta,
}: {
  badge: string;
  title: string;
  description: string;
  image: string;
  cta: { label: string; href: string } | null;
}) {
  return (
    <section className="section-shell py-8 lg:py-12">
      <div className="relative overflow-hidden rounded-[2rem] bg-primary-deep text-primary-deep-foreground">
        <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12 lg:p-14">
          <div>
            {badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">
                <Sparkles className="size-3.5" aria-hidden />
                {badge}
              </span>
            )}
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
              {title}
            </h2>
            {description && (
              <p className="mt-4 max-w-xl text-pretty text-primary-deep-foreground/75">
                {description}
              </p>
            )}
            {cta && (
              <Button asChild size="lg" variant="accent" className="mt-7">
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
            )}
          </div>

          {image && (
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl lg:aspect-[4/3]">
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          )}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-white/[0.04]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-white/[0.03]"
        />
      </div>
    </section>
  );
}
