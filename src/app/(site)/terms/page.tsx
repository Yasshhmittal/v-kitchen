import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/site/legal-page";
import { getSettings, settingList, settingText } from "@/server/services/settings.service";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settingText(settings, "pages.terms.title", "Terms of Service"),
    description: "The terms you agree to when you order from us.",
  };
}

export default async function TermsPage() {
  const settings = await getSettings();

  return (
    <LegalPage
      title={settingText(settings, "pages.terms.title", "Terms of Service")}
      sections={settingList<LegalSection>(settings, "pages.terms.body")}
    />
  );
}
