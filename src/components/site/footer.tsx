import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone, ShoppingBag } from "lucide-react";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { NewsletterForm } from "./newsletter-form";
import {
  getSettings,
  settingBool,
  settingList,
  settingText,
} from "@/server/services/settings.service";
import { formatTime24to12, normalizePhone } from "@/lib/format";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  platform: string;
  url: string;
}

interface OpeningHour {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

/**
 * Dark-green footer. Every string, link and hour comes from site settings, so
 * the owner rewrites the entire footer from /admin/settings.
 */
export async function Footer() {
  const settings = await getSettings();

  const siteName = settingText(settings, "site.name", "V-Kitchen");
  const logo = settingText(settings, "site.logo");
  const about = settingText(settings, "footer.about");
  const phone = settingText(settings, "contact.phone");
  const email = settingText(settings, "contact.email");
  const address = settingText(settings, "contact.address");
  const hoursNote = settingText(settings, "hours.note");

  const quickLinks = settingList<FooterLink>(settings, "footer.quickLinks");
  const supportLinks = settingList<FooterLink>(settings, "footer.supportLinks");
  const socials = settingList<SocialLink>(settings, "social.links").filter((link) => link.url);
  const hours = settingList<OpeningHour>(settings, "hours.weekly");

  const newsletterEnabled = settingBool(settings, "footer.newsletterEnabled", true);
  const copyright = settingText(
    settings,
    "footer.copyright",
    `© {year} ${siteName}. All rights reserved.`,
  ).replace("{year}", String(new Date().getFullYear()));

  return (
    <footer className="bg-primary-deep text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand + contact */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              {logo ? (
                <Image
                  src={logo}
                  alt={siteName}
                  width={160}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <>
                  <span className="grid size-9 place-items-center rounded-xl bg-white/15">
                    <ShoppingBag className="size-4.5" aria-hidden />
                  </span>
                  <span className="font-display text-lg font-bold">{siteName}</span>
                </>
              )}
            </Link>

            {about && <p className="mt-4 text-sm text-primary-foreground/70">{about}</p>}

            <ul className="mt-5 space-y-3 text-sm">
              {address && (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="text-primary-foreground/80">{address}</span>
                </li>
              )}
              {phone && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <a
                    href={`tel:${normalizePhone(phone)}`}
                    className="text-primary-foreground/80 underline-offset-4 hover:text-primary-foreground hover:underline"
                  >
                    {phone}
                  </a>
                </li>
              )}
              {email && (
                <li className="flex gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <a
                    href={`mailto:${email}`}
                    className="break-all text-primary-foreground/80 underline-offset-4 hover:text-primary-foreground hover:underline"
                  >
                    {email}
                  </a>
                </li>
              )}
            </ul>

            {socials.length > 0 && (
              <ul className="mt-6 flex gap-2">
                {socials.map((social) => (
                  <li key={social.platform}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.platform}
                      className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <DynamicIcon name={social.platform} className="size-[1.05rem]" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick links */}
          {quickLinks.length > 0 && (
            <nav aria-label="Quick links">
              <h3 className="font-display text-lg font-bold">Quick Links</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {quickLinks.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-primary-foreground/70 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Support links + hours */}
          <div>
            {supportLinks.length > 0 && (
              <nav aria-label="Support links">
                <h3 className="font-display text-lg font-bold">Support</h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {supportLinks.map((link) => (
                    <li key={`${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-primary-foreground/70 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {hours.length > 0 && (
              <div className="mt-8">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground/60">
                  <Clock className="size-4" aria-hidden />
                  Opening hours
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {hours.map((entry) => (
                    <li key={entry.day} className="flex justify-between gap-4">
                      <span className="text-primary-foreground/70">{entry.day.slice(0, 3)}</span>
                      <span className="tabular-nums text-primary-foreground/90">
                        {entry.closed
                          ? "Closed"
                          : `${formatTime24to12(entry.open)} – ${formatTime24to12(entry.close)}`}
                      </span>
                    </li>
                  ))}
                </ul>
                {hoursNote && (
                  <p className="mt-3 text-xs text-primary-foreground/60">{hoursNote}</p>
                )}
              </div>
            )}
          </div>

          {/* Newsletter */}
          {newsletterEnabled && (
            <NewsletterForm
              title={settingText(settings, "footer.newsletterTitle", "Stay Connected")}
              text={settingText(
                settings,
                "footer.newsletterText",
                "Join our newsletter for exclusive offers and updates.",
              )}
            />
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-primary-foreground/60 sm:flex-row sm:px-6 lg:px-8">
          <p>{copyright}</p>
          <p className="flex items-center gap-1.5">
            <ShoppingBag className="size-3.5" aria-hidden />
            Pickup only — no delivery
          </p>
        </div>
      </div>
    </footer>
  );
}
