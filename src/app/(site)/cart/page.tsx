import type { Metadata } from "next";

import { CartView } from "@/components/site/cart-view";
import { PageHeader } from "@/components/site/page-header";

/**
 * The cart lives entirely in the browser until checkout, so this page is a
 * thin server shell around a client component. It is deliberately excluded
 * from search indexing — a cart URL means nothing to anyone else.
 */
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <>
      <PageHeader
        eyebrow="Almost there"
        title="Your cart"
        lead="Check your items, then choose a pickup date and time at checkout."
        tint="cream"
      />

      <div className="section-shell py-10 lg:py-14">
        <CartView />
      </div>
    </>
  );
}
