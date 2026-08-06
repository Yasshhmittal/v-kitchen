import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CategoryCard } from "@/components/site/category-card";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { FeatureBanner } from "@/components/site/feature-banner";
import { Hero } from "@/components/site/hero";
import { MenuCard } from "@/components/site/menu-card";
import { ProductCard } from "@/components/site/product-card";
import { SectionHeading } from "@/components/site/section-heading";
import { TestimonialCard } from "@/components/site/testimonial-card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { MENU_SLOT_META } from "@/lib/constants";
import {
  toCategoryView,
  toMenuView,
  toProductView,
  toReviewView,
} from "@/server/services/mappers";
import { getDailyMenus, getSpecialMenus } from "@/server/services/menu.service";
import {
  getSettings,
  settingBool,
  settingList,
  settingText,
  setting,
} from "@/server/services/settings.service";

/**
 * Home page.
 *
 * Every heading, image, button label and card on this page is either a
 * settings value or a database row. There is no copy written into this file
 * other than accessible labels.
 */

// Menus change through the day; re-render at most once a minute rather than
// hitting the database on every request.
export const revalidate = 60;

interface Cta {
  label: string;
  href: string;
}

export default async function HomePage() {
  const settings = await getSettings();

  const [menuCategories, dailyMenus, specialMenus, featuredProducts, reviews] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, type: "MENU" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 6,
      include: { _count: { select: { menuItems: true } } },
    }),
    getDailyMenus(),
    getSpecialMenus(),
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 4,
      include: { category: { select: { name: true } }, variants: true },
    }),
    prisma.review.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ]);

  // The dish strip shows whichever slot is live right now, falling back to the
  // first published slot of the day.
  const hour = new Date().getHours();
  const currentSlot = hour < 11 ? "MORNING" : hour < 16 ? "AFTERNOON" : "EVENING";
  const liveMenu =
    dailyMenus.find((entry) => entry.slot === currentSlot) ?? dailyMenus[0] ?? null;
  const liveMenuView = liveMenu ? toMenuView(liveMenu.menu) : null;
  const specialView = specialMenus[0] ? toMenuView(specialMenus[0].menu) : null;

  return (
    <>
      <Hero
        eyebrow={settingText(settings, "home.hero.eyebrow")}
        titleTop={settingText(settings, "home.hero.titleTop", "Real Home Food.")}
        titleBottom={settingText(settings, "home.hero.titleBottom")}
        subtitle={settingText(settings, "home.hero.subtitle")}
        image={settingText(settings, "home.hero.image")}
        primaryCta={setting<Cta | null>(settings, "home.hero.primaryCta", null)}
        secondaryCta={setting<Cta | null>(settings, "home.hero.secondaryCta", null)}
        highlights={settingList(settings, "home.hero.highlights")}
      />

      {/* ---- Categories ---------------------------------------------------- */}
      {menuCategories.length > 0 && (
        <section className="section-shell py-14 lg:py-20">
          <SectionHeading
            eyebrow={settingText(settings, "home.categories.eyebrow")}
            title={settingText(settings, "home.categories.title", "Explore Our Menu")}
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {menuCategories.map((category, index) => (
              <CategoryCard
                key={category.id}
                category={toCategoryView(category)}
                href={`/menu?category=${category.slug}`}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- What's cooking now -------------------------------------------- */}
      {liveMenuView && liveMenuView.items.length > 0 && (
        <section className="bg-secondary/50 py-14 lg:py-20">
          <div className="section-shell">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                align="left"
                eyebrow={MENU_SLOT_META[liveMenuView.slot].label}
                title={liveMenuView.title}
                lead={liveMenuView.subtitle ?? MENU_SLOT_META[liveMenuView.slot].description}
                className="max-w-xl"
              />
              <Button asChild variant="outline">
                <Link href="/menu">
                  See full menu
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {liveMenuView.items.slice(0, 4).map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  blockedReason={
                    liveMenuView.isPastCutoff ? "Ordering closed for this menu" : undefined
                  }
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Feature banner ------------------------------------------------- */}
      {settingBool(settings, "home.feature.enabled", true) && (
        <FeatureBanner
          badge={settingText(settings, "home.feature.badge")}
          title={settingText(
            settings,
            "home.feature.title",
            specialView?.title ?? "Today's Special",
          )}
          description={settingText(settings, "home.feature.description")}
          image={settingText(settings, "home.feature.image")}
          cta={setting<Cta | null>(settings, "home.feature.cta", null)}
        />
      )}

      {/* ---- Laddus & namkeens ---------------------------------------------- */}
      {featuredProducts.length > 0 && (
        <section className="section-shell py-14 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              align="left"
              eyebrow="Take something home"
              title="Laddus & Namkeens"
              lead="Freshly made, packed and ready to collect."
              className="max-w-xl"
            />
            <Button asChild variant="outline">
              <Link href="/products">
                Browse all
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={toProductView(product)} />
            ))}
          </div>
        </section>
      )}

      {/* ---- Why choose us --------------------------------------------------- */}
      <WhySection settings={settings} />

      {/* ---- How ordering works ---------------------------------------------- */}
      <StepsSection settings={settings} />

      {/* ---- Testimonials ---------------------------------------------------- */}
      {reviews.length > 0 && (
        <section className="section-shell py-14 lg:py-20">
          <SectionHeading
            eyebrow={settingText(settings, "home.reviews.eyebrow")}
            title={settingText(settings, "home.reviews.title", "What Our Customers Say")}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, index) => (
              <TestimonialCard key={review.id} review={toReviewView(review)} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* ---- Closing CTA ------------------------------------------------------ */}
      <CtaSection settings={settings} />

      {/* Nothing published yet — tell the owner, not the customer. */}
      {menuCategories.length === 0 && featuredProducts.length === 0 && (
        <div className="section-shell pb-16">
          <EmptyState
            title="No menu published yet"
            description="Sign in to the admin dashboard to add categories, dishes and today's menu."
            action={{ label: "Open admin dashboard", href: "/admin" }}
          />
        </div>
      )}
    </>
  );
}

function WhySection({ settings }: { settings: Record<string, unknown> }) {
  const items = settingList<{ icon: string; title: string; text: string }>(
    settings,
    "home.why.items",
  );
  if (items.length === 0) return null;

  return (
    <section className="bg-secondary/50 py-14 lg:py-20">
      <div className="section-shell">
        <SectionHeading
          eyebrow={settingText(settings, "home.why.eyebrow")}
          title={settingText(settings, "home.why.title", "Why Choose Us")}
        />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl bg-card p-6 text-center shadow-card transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <DynamicIcon name={item.icon} className="size-6" />
              </span>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StepsSection({ settings }: { settings: Record<string, unknown> }) {
  const steps = settingList<{ icon: string; title: string; text: string }>(
    settings,
    "home.steps.items",
  );
  if (steps.length === 0) return null;

  return (
    <section className="section-shell py-14 lg:py-20">
      <SectionHeading title={settingText(settings, "home.steps.title", "How Ordering Works")} />
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative">
            {/* Connector line between steps on wide screens. */}
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[3.25rem] top-6 hidden h-px w-[calc(100%-2.5rem)] bg-border lg:block"
              />
            )}
            <span className="relative grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <DynamicIcon name={step.icon} className="size-5" />
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[0.625rem] font-bold text-accent-foreground">
                {index + 1}
              </span>
            </span>
            <h3 className="mt-4 font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CtaSection({ settings }: { settings: Record<string, unknown> }) {
  const title = settingText(settings, "home.cta.title");
  const button = setting<Cta | null>(settings, "home.cta.button", null);
  if (!title) return null;

  return (
    <section className="section-shell pb-16 lg:pb-24">
      <div className="rounded-[2rem] bg-[hsl(var(--tint-cream))] px-6 py-12 text-center sm:px-10 lg:py-16">
        <h2 className="section-heading text-balance">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
          {settingText(settings, "home.cta.subtitle")}
        </p>
        {button && (
          <Button asChild size="lg" className="mt-7">
            <Link href={button.href}>{button.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
