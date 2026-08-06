import { Footer } from "@/components/site/footer";
import { MobileNav } from "@/components/site/mobile-nav";
import { Navbar, type NavLink } from "@/components/site/navbar";
import { OrderingPausedBanner } from "@/components/site/ordering-paused-banner";
import { SiteConfigProvider, type SiteConfig } from "@/hooks/use-site-config";
import {
  getSettings,
  settingBool,
  settingList,
  settingNumber,
  settingText,
} from "@/server/services/settings.service";

/**
 * Layout for every public page.
 *
 * Reads settings once on the server and hands the client-side chrome exactly
 * what it needs. Nothing in the navbar or footer is written in code — change a
 * link or a phone number in /admin/settings and it appears here.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  const config: SiteConfig = {
    siteName: settingText(settings, "site.name", "V-Kitchen"),
    logo: settingText(settings, "site.logo"),
    phone: settingText(settings, "contact.phone"),
    whatsapp: settingText(settings, "contact.whatsapp"),
    email: settingText(settings, "contact.email"),
    address: settingText(settings, "contact.address"),
    currency: settingText(settings, "site.currency", "INR"),
    locale: settingText(settings, "site.locale", "en-IN"),
    orderingEnabled: settingBool(settings, "ordering.enabled", true),
    pausedMessage: settingText(settings, "ordering.pausedMessage"),
    minOrderValue: settingNumber(settings, "ordering.minOrderValue", 0),
    requireLogin: settingBool(settings, "ordering.requireLogin", false),
  };

  const links = settingList<NavLink>(settings, "nav.links").filter(
    (link) => link.label && link.href,
  );

  return (
    <SiteConfigProvider config={config}>
      <div className="flex min-h-dvh flex-col">
        {!config.orderingEnabled && config.pausedMessage && (
          <OrderingPausedBanner message={config.pausedMessage} />
        )}
        <Navbar links={links} />
        {/* Bottom padding clears the mobile bottom bar. */}
        <main id="main" className="flex-1 pb-16 lg:pb-0">
          {children}
        </main>
        <Footer />
        <MobileNav />
      </div>
    </SiteConfigProvider>
  );
}
