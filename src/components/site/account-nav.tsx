"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LogOut, Receipt, User } from "lucide-react";

import { cn } from "@/lib/cn";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/account", label: "Orders", icon: Receipt },
  { href: "/account/favourites", label: "Favourites", icon: Heart },
  { href: "/account/profile", label: "Profile", icon: User },
];

export function AccountNav() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post("/api/auth/logout");
    } finally {
      // A hard navigation so the server-rendered header stops showing a name
      // that is no longer signed in.
      window.location.assign("/");
    }
  }

  return (
    <nav aria-label="Account" className="lg:w-52 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <link.icon className="size-4" aria-hidden />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        className="mt-4 hidden w-full justify-start text-muted-foreground lg:flex"
        disabled={signingOut}
        onClick={signOut}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </nav>
  );
}
