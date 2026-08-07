import type { Metadata } from "next";
import { ShoppingBag, UtensilsCrossed, Package, Users } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Admin dashboard.
 *
 * Shows key metrics at a glance. Phase 2 will add charts and deeper analytics,
 * but for Phase 1 a simple stat grid is enough to confirm the shell works.
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Here's what's happening today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Orders today"
          value="—"
          icon={ShoppingBag}
          description="Live count will appear here"
        />
        <StatCard
          label="Menu items"
          value="—"
          icon={UtensilsCrossed}
          description="Total dishes available"
        />
        <StatCard
          label="Products"
          value="—"
          icon={Package}
          description="Laddus and namkeen"
        />
        <StatCard
          label="Customers"
          value="—"
          icon={Users}
          description="Registered accounts"
        />
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Order stream and quick actions will appear here.
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  description: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}
