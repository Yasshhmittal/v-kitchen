import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

/**
 * Shown wherever a list has nothing in it. An empty menu on the public site is
 * a normal state — the kitchen simply hasn't published one — so this reads as
 * information rather than as an error.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      )}
      {action &&
        (action.href ? (
          <Button asChild className="mt-6">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button className="mt-6" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
