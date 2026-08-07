import type { Metadata } from "next";

import { CustomOrderForm } from "@/components/site/custom-order-form";
import { PageHeader } from "@/components/site/page-header";
import { getSettings, settingText } from "@/server/services/settings.service";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settingText(settings, "pages.custom.title", "Custom orders"),
    description: settingText(settings, "pages.custom.lead"),
  };
}

export default async function CustomOrderPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        eyebrow={settingText(settings, "pages.custom.eyebrow")}
        title={settingText(settings, "pages.custom.title", "Ask for something special")}
        lead={settingText(settings, "pages.custom.lead")}
        tint="peach"
      />

      <div className="section-shell py-10 lg:py-14">
        <CustomOrderForm phone={settingText(settings, "contact.phone")} />
      </div>
    </>
  );
}
