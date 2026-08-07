import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FavouritesGrid } from "@/components/site/favourites-grid";
import { getCustomerSession } from "@/server/auth/session";
import { getCustomerFavourites } from "@/server/services/customer.service";
import { toMenuItemView, toProductView } from "@/server/services/mappers";

export const metadata: Metadata = {
  title: "Your favourites",
  robots: { index: false, follow: false },
};

/**
 * Saved dishes and products.
 *
 * Mapped through the same mappers and rendered with the same cards as the menu,
 * so a favourite shows its *current* price and availability rather than what it
 * cost when it was saved.
 */
export default async function FavouritesPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  const { menuItems, products } = await getCustomerFavourites(session.customerId);

  return (
    <FavouritesGrid
      menuItems={menuItems.map((item) => toMenuItemView(item))}
      products={products.map((product) => toProductView(product))}
    />
  );
}
