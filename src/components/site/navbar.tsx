"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu as MenuIcon, Phone, ShoppingBag, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/overlays";
import { ThemeToggle } from "@/components/shared/providers";
import { CartSheet } from "./cart-sheet";
import { useCart } from "@/hooks/use-cart";
import { useSiteConfig } from "@/hooks/use-site-config";
import { cn } from "@/lib/cn";
import { normalizePhone } from "@/lib/format";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Sticky top navigation. Links, brand and phone number all arrive as props
 * from the server layout, which reads them from site settings — nothing here
 * is written into the markup.
 */
export function Navbar({ links }: { links: NavLink[] }) {
  const { siteName, logo, phone, orderingEnabled } = useSiteConfig();
  const { count, isReady } = useCart();
  const pathname = usePathname();

  const [cartOpen, setCartOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer whenever navigation actually happens.
  React.useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b transition-all duration-300",
          scrolled
            ? "border-border/70 bg-background/85 shadow-soft backdrop-blur-md"
            : "border-transparent bg-background",
        )}
      >
        <nav
          className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8"
          aria-label="Main"
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {logo ? (
              <Image
                src={logo}
                alt={siteName}
                width={160}
                height={40}
                priority
                className="h-9 w-auto object-contain"
              />
            ) : (
              <>
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <ShoppingBag className="size-4.5" aria-hidden />
                </span>
                <span className="font-display text-lg font-bold tracking-tight">{siteName}</span>
              </>
            )}
          </Link>

          <ul className="mx-auto hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-secondary text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
            {phone && (
              <a
                href={`tel:${normalizePhone(phone)}`}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:inline-flex"
              >
                <Phone className="size-4" aria-hidden />
                {phone}
              </a>
            )}

            <ThemeToggle className="hidden sm:inline-flex" />

            <Button variant="ghost" size="icon" asChild aria-label="Your account">
              <Link href="/account">
                <User className="size-[1.15rem]" />
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={isReady && count > 0 ? `Cart, ${count} items` : "Cart"}
            >
              <ShoppingBag className="size-[1.15rem]" aria-hidden />
              {isReady && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.6875rem] font-bold leading-5 text-accent-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>

            {orderingEnabled && (
              <Button asChild className="hidden lg:inline-flex">
                <Link href="/menu">Order Now</Link>
              </Button>
            )}

            <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogPrimitive.Trigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <MenuIcon className="size-[1.15rem]" />
                </Button>
              </DialogPrimitive.Trigger>
              <SheetContent side="left" aria-describedby={undefined}>
                <DialogPrimitive.Title className="border-b px-5 py-4 pr-14 text-base font-semibold">
                  {siteName}
                </DialogPrimitive.Title>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <ul className="space-y-1">
                    {links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={isActive(link.href) ? "page" : undefined}
                          className={cn(
                            "block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                            isActive(link.href)
                              ? "bg-secondary text-primary"
                              : "hover:bg-secondary",
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 space-y-1 border-t pt-4">
                    <Link
                      href="/account"
                      className="block rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      My account
                    </Link>
                    <Link
                      href="/track"
                      className="block rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      Track an order
                    </Link>
                  </div>
                </div>
                <div className="shrink-0 space-y-2 border-t p-4">
                  {orderingEnabled && (
                    <Button asChild className="w-full">
                      <Link href="/menu">Order Now</Link>
                    </Button>
                  )}
                  {phone && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={`tel:${normalizePhone(phone)}`}>
                        <Phone className="size-4" aria-hidden />
                        {phone}
                      </a>
                    </Button>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-muted-foreground">Appearance</span>
                    <ThemeToggle />
                  </div>
                </div>
              </SheetContent>
            </DialogPrimitive.Root>
          </div>
        </nav>
      </header>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
