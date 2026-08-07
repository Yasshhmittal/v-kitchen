import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { BulkOrderForm } from "@/components/site/bulk-order-form";
import { PageHeader } from "@/components/site/page-header";
import { Card } from "@/components/ui/card";
import {
  getSettings,
  settingList,
  settingText,
} from "@/server/services/settings.service";

/** Copy is owner-editable, so revalidate rather than build once. */
export const revalidate = 300;

interface Point {
  heading: string;
  text: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settingText(settings, "pages.bulk.title", "Bulk & catering orders"),
    description: settingText(settings, "pages.bulk.lead"),
  };
}

export default async function BulkOrderPage() {
  const settings = await getSettings();
  const points = settingList<Point>(settings, "pages.bulk.points");

  return (
    <>
      <PageHeader
        eyebrow={settingText(settings, "pages.bulk.eyebrow")}
        title={settingText(settings, "pages.bulk.title", "Bulk & catering orders")}
        lead={settingText(settings, "pages.bulk.lead")}
        tint="green"
      />

      <div className="section-shell py-10 lg:py-14">
        {points.length > 0 && (
          <div className="mx-auto mb-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {points.map((point) => (
              <Card key={point.heading} className="p-5">
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                <h2 className="mt-3 text-sm font-semibold">{point.heading}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{point.text}</p>
              </Card>
            ))}
          </div>
        )}

        <BulkOrderForm phone={settingText(settings, "contact.phone")} />
      </div>
    </>
  );
}
