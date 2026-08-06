"use client";

import * as React from "react";

import { formatCurrency as baseFormatCurrency, type Money } from "@/lib/format";

/**
 * The handful of owner-controlled values client components need.
 *
 * Server components read settings directly; client components (cart, checkout,
 * product cards) can't, so the public layout hands them down through this
 * context once instead of drilling props through every level.
 */

export interface SiteConfig {
  siteName: string;
  logo: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  currency: string;
  locale: string;
  orderingEnabled: boolean;
  pausedMessage: string;
  minOrderValue: number;
  requireLogin: boolean;
}

const SiteConfigContext = React.createContext<SiteConfig | null>(null);

export function SiteConfigProvider({
  config,
  children,
}: {
  config: SiteConfig;
  children: React.ReactNode;
}) {
  return <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfig {
  const context = React.useContext(SiteConfigContext);
  if (!context) throw new Error("useSiteConfig must be used inside <SiteConfigProvider>");
  return context;
}

/** Currency formatter bound to the owner's currency and locale settings. */
export function useCurrency() {
  const { currency, locale } = useSiteConfig();
  return React.useCallback(
    (value: Money, showDecimals = false) =>
      baseFormatCurrency(value, { currency, locale, showDecimals }),
    [currency, locale],
  );
}
