"use client";

import Link from "next/link";
import type { MenuSlot } from "@prisma/client";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { MENU_SLOT_META } from "@/lib/constants";
import { cn } from "@/lib/cn";

/**
 * Slot switcher for the menu page.
 *
 * These are real links, not client-side state, so a customer can bookmark
 * "?slot=evening" and search engines index each slot separately.
 */
export function SlotTabs({
  slots,
  activeSlot,
  basePath = "/menu",
}: {
  slots: MenuSlot[];
  activeSlot: MenuSlot;
  basePath?: string;
}) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-2 rounded-full bg-secondary p-1.5">
        {slots.map((slot) => {
          const meta = MENU_SLOT_META[slot];
          const active = slot === activeSlot;
          return (
            <li key={slot}>
              <Link
                href={`${basePath}?slot=${slot.toLowerCase()}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  active
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <DynamicIcon
                  name={meta.icon}
                  className={cn("size-4", active && "text-primary")}
                />
                {meta.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
