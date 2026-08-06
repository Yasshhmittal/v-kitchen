import type { Metadata } from "next";
import { Clock, UtensilsCrossed } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { MenuCard } from "@/components/site/menu-card";
import { PageHeader } from "@/components/site/page-header";
import { SlotTabs } from "@/components/site/slot-tabs";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { DAILY_SLOTS, MENU_SLOT_META } from "@/lib/constants";
import { formatTime24to12 } from "@/lib/format";
import { toMenuView } from "@/server/services/mappers";
import { getDailyMenus, getMenuForSlot } from "@/server/services/menu.service";
import { getSettings, settingText } from "@/server/services/settings.service";
import type { MenuSlot } from "@prisma/client";

/**
 * Today's menu, one slot at a time.
 *
 * The slot comes from the query string so each is linkable and indexable; when
 * none is given we pick whichever slot is live at the moment the page renders.
 */

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "Today's Menu",
    description: settingText(
      settings,
      "seo.description",
      "See what's cooking this morning, afternoon and evening. Order online for pickup.",
    ),
  };
}

function slotFromParam(value: string | undefined): MenuSlot | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (DAILY_SLOTS as string[]).includes(upper) ? (upper as MenuSlot) : null;
}

/** Whichever daily slot the shop is in right now. */
function currentSlot(): MenuSlot {
  const hour = new Date().getHours();
  return hour < 11 ? "MORNING" : hour < 16 ? "AFTERNOON" : "EVENING";
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; category?: string }>;
}) {
  const params = await searchParams;
  const published = await getDailyMenus();

  // Only offer tabs for slots that actually have a published menu today.
  const availableSlots = published.map((entry) => entry.slot);
  const requested = slotFromParam(params.slot);
  const activeSlot =
    requested && availableSlots.includes(requested)
      ? requested
      : availableSlots.includes(currentSlot())
        ? currentSlot()
        : (availableSlots[0] ?? currentSlot());

  const [menu, category] = await Promise.all([
    getMenuForSlot(activeSlot),
    params.category
      ? prisma.category.findUnique({ where: { slug: params.category }, select: { name: true, slug: true } })
      : Promise.resolve(null),
  ]);

  const view = menu ? toMenuView(menu) : null;
  const meta = MENU_SLOT_META[activeSlot];

  // Filtering by category is a view concern — the menu is already loaded.
  const items = view
    ? category
      ? view.items.filter((item) => item.categoryName === category.name)
      : view.items
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Pickup only"
        title={view?.title ?? "Today's Menu"}
        lead={view?.subtitle ?? meta.description}
      >
        {availableSlots.length > 0 && (
          <SlotTabs slots={availableSlots} activeSlot={activeSlot} />
        )}
      </PageHeader>

      <div className="section-shell py-10 lg:py-14">
        {view && (
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <Badge variant="info">{meta.label}</Badge>
            {view.orderCutoffTime && (
              <span
                className={
                  view.isPastCutoff
                    ? "inline-flex items-center gap-1.5 text-sm font-medium text-destructive"
                    : "inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                }
              >
                <Clock className="size-4" aria-hidden />
                {view.isPastCutoff
                  ? `Ordering closed at ${formatTime24to12(view.orderCutoffTime)}`
                  : `Order by ${formatTime24to12(view.orderCutoffTime)}`}
              </span>
            )}
            {category && (
              <span className="text-sm text-muted-foreground">
                Filtered by <strong className="font-semibold text-foreground">{category.name}</strong>
              </span>
            )}
          </div>
        )}

        {items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                blockedReason={view?.isPastCutoff ? "Ordering closed" : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            title={
              category
                ? `Nothing from ${category.name} on this menu`
                : `No ${meta.label.toLowerCase()} menu published`
            }
            description={
              category
                ? "Try clearing the filter to see everything on this menu."
                : "The kitchen hasn't published this menu yet. Check the other slots or come back a little later."
            }
            action={category ? { label: "Clear filter", href: `/menu?slot=${activeSlot.toLowerCase()}` } : undefined}
          />
        )}
      </div>
    </>
  );
}
