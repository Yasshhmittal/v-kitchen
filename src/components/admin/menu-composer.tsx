"use client";

import * as React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/cn";
import { api, queryString } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/form-controls";
import type { MenuItemWithCategory } from "@/server/services/menu-item.service";

/**
 * The dish composer behind the menu editor.
 *
 * A menu is a composition of reusable dishes, so this is two lists: the
 * catalogue you pick from on the left, and what's on the menu on the right.
 * Each chosen dish can carry a price override — the same dish costs more as
 * part of a festival menu without editing the dish itself.
 */

export interface ComposerEntry {
  menuItemId: string;
  priceOverride?: number;
  isAvailable: boolean;
  sortOrder: number;
  /** Kept alongside the id so the chosen list renders without a second fetch. */
  item?: { name: string; image: string | null; price: number; isVeg: boolean };
}

export function MenuComposer({
  value,
  onChange,
  error,
}: {
  value: ComposerEntry[];
  onChange: (entries: ComposerEntry[]) => void;
  error?: string;
}) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const itemsQuery = useQuery({
    queryKey: ["admin", "menu-items", "picker", debouncedSearch],
    queryFn: () =>
      api.get<MenuItemWithCategory[]>(
        `/api/admin/menu-items${queryString({
          search: debouncedSearch,
          pageSize: 50,
          sort: "name",
          order: "asc",
        })}`,
      ),
  });

  const chosenIds = new Set(value.map((entry) => entry.menuItemId));

  function addItem(item: MenuItemWithCategory) {
    if (chosenIds.has(item.id)) return;
    onChange([
      ...value,
      {
        menuItemId: item.id,
        isAvailable: true,
        sortOrder: value.length,
        item: {
          name: item.name,
          image: item.image,
          price: Number(item.price),
          isVeg: item.isVeg,
        },
      },
    ]);
  }

  function updateEntry(index: number, patch: Partial<ComposerEntry>) {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(index: number) {
    // Re-number so sortOrder stays dense after a removal.
    onChange(
      value.filter((_, i) => i !== index).map((entry, i) => ({ ...entry, sortOrder: i })),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(next.map((entry, i) => ({ ...entry, sortOrder: i })));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium">Dishes on this menu</label>
        <span className="text-xs text-muted-foreground">
          {value.length} {value.length === 1 ? "dish" : "dishes"}
        </span>
      </div>

      <div className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
        {/* Catalogue ------------------------------------------------------- */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dishes to add…"
              className="pl-9"
            />
          </div>

          <div className="h-64 overflow-y-auto rounded-lg border bg-secondary/30">
            {itemsQuery.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading dishes…</p>
            ) : itemsQuery.error ? (
              <p className="p-4 text-sm text-destructive">Couldn&apos;t load dishes.</p>
            ) : (itemsQuery.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {search ? "No dishes match that search." : "No dishes in the catalogue yet."}
              </p>
            ) : (
              <ul className="divide-y">
                {(itemsQuery.data ?? []).map((item) => {
                  const added = chosenIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => addItem(item)}
                        disabled={added}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                          added
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-background",
                        )}
                      >
                        <Thumb src={item.image} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatCurrency(item.price)}
                          </span>
                        </span>
                        {added ? (
                          <span className="text-xs text-muted-foreground">Added</span>
                        ) : (
                          <Plus className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Chosen ---------------------------------------------------------- */}
        <div className="h-[19.75rem] overflow-y-auto rounded-lg border">
          {value.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <UtensilsCrossed className="size-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Nothing on this menu yet. Pick dishes from the left.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {value.map((entry, index) => (
                <li key={entry.menuItemId} className="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <Thumb src={entry.item?.image ?? null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {entry.item?.name ?? "Dish"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.item ? formatCurrency(entry.item.price) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        aria-label="Move down"
                        disabled={index === value.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        aria-label={`Remove ${entry.item?.name ?? "dish"}`}
                        onClick={() => removeEntry(index)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pl-12">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      value={entry.priceOverride ?? ""}
                      onChange={(event) =>
                        updateEntry(index, {
                          priceOverride:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                        })
                      }
                      placeholder="Menu price"
                      aria-label={`Price override for ${entry.item?.name ?? "dish"}`}
                      className="h-9 max-w-[9rem]"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={entry.isAvailable}
                        onCheckedChange={(checked) =>
                          updateEntry(index, { isAvailable: checked })
                        }
                      />
                      Available
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Leave the price blank to use the dish&apos;s own price. Order here is the order
          customers see.
        </p>
      )}
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
      {src ? (
        <Image src={src} alt="" fill sizes="36px" className="object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <UtensilsCrossed className="size-4" />
        </span>
      )}
    </span>
  );
}
