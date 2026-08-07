import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/site/checkout-form";
import { PageHeader } from "@/components/site/page-header";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/server/auth/session";
import {
  getSettings,
  isLoginRequired,
  settingText,
} from "@/server/services/settings.service";

/**
 * Checkout.
 *
 * Rendered per request — a signed-in customer gets their details pre-filled,
 * and the pickup instructions come from settings, so this can never be cached.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Choose a pickup date and time, then place your order.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const session = await getCustomerSession();

  // When the owner has switched guest checkout off, send guests to sign in
  // before they fill anything in — the order API would refuse it anyway, and
  // finding that out after typing an address is the worst time to learn it.
  if (!session && (await isLoginRequired())) {
    redirect(`/account/login?next=${encodeURIComponent("/checkout")}`);
  }

  const [settings, customer] = await Promise.all([
    getSettings(),
    session
      ? prisma.customer.findUnique({
          where: { id: session.customerId },
          select: { name: true, phone: true, email: true },
        })
      : null,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Last step"
        title="Checkout"
        lead="Tell us who's collecting and when. Pay at the counter when you pick up."
        tint="cream"
      />

      <div className="section-shell py-10 lg:py-14">
        <CheckoutForm
          defaults={
            customer
              ? {
                  name: customer.name,
                  phone: customer.phone,
                  email: customer.email ?? "",
                }
              : null
          }
          pickupNote={settingText(settings, "contact.pickupNote")}
        />
      </div>
    </>
  );
}
