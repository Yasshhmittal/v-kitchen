import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/shared/providers";
import { getSettings, settingText } from "@/server/services/settings.service";

/**
 * Root layout. Fonts are self-hosted by next/font (no render-blocking request
 * to Google), and the title/description come from the database so the owner
 * controls them from /admin/settings.
 */

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteName = settingText(settings, "site.name", "V-Kitchen");
  const title = settingText(settings, "seo.title", `${siteName} — Fresh food, ready for pickup`);
  const description = settingText(
    settings,
    "seo.description",
    "Daily home-cooked menus, laddus and namkeens made fresh. Order online and pick up.",
  );
  const ogImage = settingText(settings, "seo.ogImage");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(baseUrl),
    title: { default: title, template: `%s · ${siteName}` },
    description,
    keywords: settingText(settings, "seo.keywords")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    applicationName: siteName,
    openGraph: {
      title,
      description,
      siteName,
      type: "website",
      url: baseUrl,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#121613" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body>
        {/* First stop for keyboard and screen-reader users on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
