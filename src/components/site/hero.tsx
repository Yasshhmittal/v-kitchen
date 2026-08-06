import Image from "next/image";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Button } from "@/components/ui/button";

interface Cta {
  label: string;
  href: string;
}

interface Highlight {
  icon: string;
  title: string;
  subtitle: string;
}

/**
 * Split hero: copy on the left, food photo on the right. Every string, both
 * buttons and the highlight row are settings values.
 */
export function Hero({
  eyebrow,
  titleTop,
  titleBottom,
  subtitle,
  image,
  primaryCta,
  secondaryCta,
  highlights,
}: {
  eyebrow: string;
  titleTop: string;
  titleBottom: string;
  subtitle: string;
  image: string;
  primaryCta: Cta | null;
  secondaryCta: Cta | null;
  highlights: Highlight[];
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Soft radial wash behind the copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_20%,hsl(var(--tint-green))_0%,transparent_60%)]"
      />

      <div className="section-shell relative grid gap-10 py-12 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
        <div>
          {eyebrow && <p className="eyebrow-accent">{eyebrow}</p>}

          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.75rem]">
            {titleTop}
            {titleBottom && (
              <>
                <br />
                <span className="text-primary">{titleBottom}</span>
              </>
            )}
          </h1>

          {subtitle && (
            <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              {subtitle}
            </p>
          )}

          {(primaryCta || secondaryCta) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryCta && (
                <Button asChild size="lg">
                  <Link href={primaryCta.href}>{primaryCta.label}</Link>
                </Button>
              )}
              {secondaryCta && (
                <Button asChild size="lg" variant="outline">
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              )}
            </div>
          )}

          {highlights.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-5 border-t border-border/70 pt-8">
              {highlights.map((highlight) => (
                <li key={highlight.title} className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <DynamicIcon name={highlight.icon} className="size-5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-bold">{highlight.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {highlight.subtitle}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-secondary shadow-lift lg:aspect-square">
            {image ? (
              <Image
                src={image}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center gap-3 text-muted-foreground">
                <UtensilsCrossed className="size-16" aria-hidden />
              </div>
            )}
          </div>

          {/* Decorative rings echoing the reference layout. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -left-8 -z-10 size-40 rounded-full bg-accent/15 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 -z-10 size-32 rounded-full bg-primary/15 blur-2xl"
          />
        </div>
      </div>
    </section>
  );
}
