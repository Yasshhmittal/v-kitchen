import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/site/legal-page";
import { getSettings, settingList, settingText } from "@/server/services/settings.service";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settingText(settings, "pages.privacy.title", "Privacy Policy"),
    description: "How we handle the details you give us when you order.",
  };
}

export default async function PrivacyPage() {
  const settings = await getSettings();

  return (
    <LegalPage
      title={settingText(settings, "pages.privacy.title", "Privacy Policy")}
      sections={settingList<LegalSection>(settings, "pages.privacy.body")}
    />
  );
}
