"use client";

import {
  Award,
  Bell,
  Cake,
  ChefHat,
  Clock,
  Cookie,
  Croissant,
  Facebook,
  Flame,
  Gift,
  Heart,
  IceCreamCone,
  Instagram,
  Leaf,
  MapPin,
  Moon,
  PartyPopper,
  Phone,
  Salad,
  ShieldCheck,
  ShoppingBag,
  Soup,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Timer,
  Truck,
  Twitter,
  Utensils,
  Wheat,
  Youtube,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Icons referenced by name from the database.
 *
 * Settings and categories store an icon *name* (a string the owner picks in
 * the admin), not a component — so this registry is the bridge. Adding an icon
 * here makes it available in the admin picker automatically.
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  award: Award,
  bell: Bell,
  cake: Cake,
  "chef-hat": ChefHat,
  clock: Clock,
  cookie: Cookie,
  croissant: Croissant,
  facebook: Facebook,
  flame: Flame,
  gift: Gift,
  heart: Heart,
  "ice-cream": IceCreamCone,
  instagram: Instagram,
  leaf: Leaf,
  "map-pin": MapPin,
  moon: Moon,
  "party-popper": PartyPopper,
  phone: Phone,
  salad: Salad,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  soup: Soup,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  sunrise: Sunrise,
  sunset: Sunset,
  timer: Timer,
  truck: Truck,
  utensils: Utensils,
  wheat: Wheat,
  x: Twitter,
  youtube: Youtube,
};

/** Names offered in the admin icon picker. */
export const ICON_NAMES = Object.keys(ICON_REGISTRY).sort();

export function DynamicIcon({
  name,
  className,
  fallback = "sparkles",
}: {
  name?: string | null;
  className?: string;
  fallback?: string;
}) {
  const Icon = ICON_REGISTRY[name ?? ""] ?? ICON_REGISTRY[fallback] ?? Sparkles;
  return <Icon className={cn("size-5", className)} aria-hidden />;
}
