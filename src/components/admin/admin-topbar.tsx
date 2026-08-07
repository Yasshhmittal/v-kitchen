"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, User, Store, X } from "lucide-react";
import type { Role } from "@prisma/client";

import { cn } from "@/lib/cn";
import { api } from "@/lib/api-client";
import { can } from "@/server/auth/rbac";
import { ROLE_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/providers";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Dialog,
  SheetContent,
} from "@/components/ui/overlays";
import { ADMIN_NAV_SECTIONS } from "./admin-sidebar";

export function AdminTopbar({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: Role;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api.post("/api/admin/auth/logout");
    } finally {
      // Navigate regardless — the cookies are gone even if the request failed,
      // and leaving the user on a dead session is worse than a stray error.
      router.replace("/admin/login");
      router.refresh();
    }
  };

  const sections = ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(role, item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-semibold lg:hidden">V-Kitchen</span>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-secondary"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials(name)}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{name}</span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="normal-case">
              <span className="block text-sm font-semibold text-foreground">{name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
              <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {ROLE_META[role].label}
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/admin/profile">
                <User className="size-4" />
                My profile
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/" target="_blank">
                <Store className="size-4" />
                View live site
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem destructive onSelect={signOut} disabled={signingOut}>
              <LogOut className="size-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile navigation */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64">
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
                  {section.items.map((item) => {
                    const active =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Dialog>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
