import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/site/profile-form";
import { getCustomerSession } from "@/server/auth/session";
import { getCustomerProfile } from "@/server/services/customer.service";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  const profile = await getCustomerProfile(session.customerId);
  // The session cookie outlives the row it points at only if an admin has been
  // pruning records, but a signed-in page with no customer behind it is a dead
  // end — send them back through sign-in rather than render an empty form.
  if (!profile) redirect("/account/login");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These are used on every order you place, so it&rsquo;s worth keeping them current.
        </p>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}
