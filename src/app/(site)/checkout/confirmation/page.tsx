import type { Metadata } from "next";

import { OrderConfirmation } from "@/components/site/order-confirmation";
import { getSettings, settingText } from "@/server/services/settings.service";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage() {
  const settings = await getSettings();

  return (
    <div className="section-shell py-14 lg:py-20">
      <OrderConfirmation
        pickupNote={settingText(settings, "contact.pickupNote")}
        address={settingText(settings, "contact.address")}
        phone={settingText(settings, "contact.phone")}
      />
    </div>
  );
}
