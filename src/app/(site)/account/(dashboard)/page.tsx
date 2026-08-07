import type { Metadata } from "next";

import { AccountOrders } from "@/components/site/account-orders";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

export default function AccountOrdersPage() {
  return <AccountOrders />;
}
