import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { MenuCard } from "@/components/site/menu-card";
import { PageHeader } from "@/components/site/page-header";
import { Badge } from "@/components/ui/badge";
import { MENU_SLOT_META } from "@/lib/constants";
import { formatTime24to12 } from "@/lib/format";
import { toMenuView } from "@/server/services/mappers";
import { getSpecialMenus } from "@/server/services/menu.service";

/**
 * Specials: Sunday menus, festival menus, limited-time and seasonal dishes.
 * Which of these appear is entirely a function of what the owner has published
 * and, for Sunday, what day it is.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Specials",
  description: "Sunday specials, festival menus and limited-time dishes — order online for pickup.",
};

export default async function SpecialsPage() {
  const specials = await getSpecialMenus();

  return (
    <>
      <PageHeader
        eyebrow="Something extra"
        title="Specials"
        lead="Weekend feasts, festival menus and dishes we only make now and then."
        tint="peach"
      />

      <div className="section-shell space-y-14 py-10 lg:py-16">
        {specials.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title="No specials right now"
            description="Nothing special is on today. Have a look at the regular menu — it changes through the day."
            action={{ label: "See today's menu", href: "/menu" }}
          />
        )}

        {specials.map(({ menu }) => {
          const view = toMenuView(menu);
          const meta = MENU_SLOT_META[view.slot];

          return (
            <section key={view.id} aria-labelledby={`special-${view.id}`}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Badge variant="accent">{meta.label}</Badge>
                  <h2
                    id={`special-${view.id}`}
                    className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    {view.title}
                  </h2>
                  {view.subtitle && (
                    <p className="mt-2 max-w-2xl text-muted-foreground">{view.subtitle}</p>
                  )}
                </div>
                {view.orderCutoffTime && (
                  <p
                    className={
                      view.isPastCutoff
                        ? "text-sm font-medium text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {view.isPastCutoff
                      ? "Ordering closed for today"
                      : `Order by ${formatTime24to12(view.orderCutoffTime)}`}
                  </p>
                )}
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {view.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    blockedReason={view.isPastCutoff ? "Ordering closed" : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
