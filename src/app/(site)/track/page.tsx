import * as React from "react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/site/page-header";
import { TrackOrder } from "@/components/site/track-order";
import { getSettings, settingText } from "@/server/services/settings.service";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the progress of your order with your order number and phone number.",
  robots: { index: false, follow: true },
};

export default async function TrackPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        eyebrow="Order status"
        title="Track your order"
        lead="Enter your order number and the phone number you ordered with."
        tint="sage"
      />

      <div className="section-shell py-10 lg:py-14">
        {/* useSearchParams needs a Suspense boundary to keep the shell static. */}
        <React.Suspense fallback={<div className="h-56" aria-hidden />}>
          <TrackOrder address={settingText(settings, "contact.address")} />
        </React.Suspense>
      </div>
    </>
  );
}
