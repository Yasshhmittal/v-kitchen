"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Sparkles, User, UtensilsCrossed } from "lucide-react";

import { CartSheet } from "./cart-sheet";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/specials", label: "Specials", icon: Sparkles },
  { href: "/account", label: "Account", icon: User },
] as const;

/**
 * Thumb-reachable bottom bar for phones, with the cart as a raised centre
 * button. Hidden from `lg` up, where the top navbar takes over.
 */
export function MobileNav() {
  const { count, isReady } = useCart();
  const pathname = usePathname();
  const [cartOpen, setCartOpen] = React.useState(false);

  // Checkout is a focused flow — a nav bar there invites people to leave.
  if (pathname.startsWith("/checkout") || pathname.startsWith("/admin")) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {TABS.slice(0, 2).map((tab) => (
            <NavTab key={tab.href} {...tab} active={isActive(tab.href)} />
          ))}

          <li className="relative flex w-1/5 justify-center">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="absolute -top-5 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={isReady && count > 0 ? `Cart, ${count} items` : "Cart"}
            >
              <ShoppingBag className="size-5" aria-hidden />
              {isReady && count > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.6875rem] font-bold leading-5 text-accent-foreground ring-2 ring-background">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          </li>

          {TABS.slice(2).map((tab) => (
            <NavTab key={tab.href} {...tab} active={isActive(tab.href)} />
          ))}
        </ul>
      </nav>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <li className="w-1/5">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
