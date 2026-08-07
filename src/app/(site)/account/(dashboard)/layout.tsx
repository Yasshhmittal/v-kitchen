import { redirect } from "next/navigation";

import { PageHeader } from "@/components/site/page-header";
import { AccountNav } from "@/components/site/account-nav";
import { getCustomerSession } from "@/server/auth/session";

/**
 * The signed-in account area.
 *
 * A route group, so `/account/login` and `/account/register` sit outside this
 * guard and stay reachable — a login page behind a login check is a redirect
 * loop.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  return (
    <>
      <PageHeader eyebrow="Your account" title={`Hello, ${session.name}`} tint="sage" />

      <div className="section-shell py-8 lg:py-12">
        <div className="flex flex-col gap-8 lg:flex-row">
          <AccountNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
