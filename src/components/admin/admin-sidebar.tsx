"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  CalendarDays,
  Package,
  Tags,
  PartyPopper,
  ChefHat,
  Users,
  Settings,
  UserCog,
  Images,
  Store,
} from "lucide-react";
import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { can, type Permission } from "@/server/auth/rbac";

/**
 * Admin navigation.
 *
 * Items are filtered by the signed-in role, but that is presentation only —
 * hiding a link is not access control. Every route handler behind these links
 * re-checks the same permission server-side.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "orders.view" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag, permission: "orders.view" },
    ],
  },
  {
    title: "Menu",
    items: [
      { href: "/admin/menus", label: "Menus", icon: CalendarDays, permission: "menu.view" },
      { href: "/admin/menu-items", label: "Dishes", icon: UtensilsCrossed, permission: "menu.view" },
      { href: "/admin/categories", label: "Categories", icon: Tags, permission: "menu.view" },
    ],
  },
  {
    title: "Shop",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "products.view" },
    ],
  },
  {
    title: "Enquiries",
    items: [
      {
        href: "/admin/bulk-orders",
        label: "Bulk orders",
        icon: PartyPopper,
        permission: "requests.view",
      },
      {
        href: "/admin/custom-orders",
        label: "Custom orders",
        icon: ChefHat,
        permission: "requests.view",
      },
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view" },
    ],
  },
  {
    title: "Site",
    items: [
      { href: "/admin/media", label: "Media", icon: Images, permission: "media.manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
      { href: "/admin/users", label: "Staff", icon: UserCog, permission: "users.manage" },
    ],
  },
];

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(role, item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-background lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-4" />
        </span>
        <span className="font-bold tracking-tight">V-Kitchen</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Store className="size-4" />
          View live site
        </Link>
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  // `/admin` would otherwise match every child route, so it needs an exact
  // comparison while the rest match their subtree.
  const active =
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export { SECTIONS as ADMIN_NAV_SECTIONS };
