import { Suspense } from "react";
import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getPublicSettings } from "@/server/services/settings.service";

export const metadata: Metadata = {
  title: "Admin login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const settings = await getPublicSettings();

  return (
    // The form reads `?next=` to return the user where they were headed, and
    // `useSearchParams` needs a boundary for the shell to stay static.
    <Suspense fallback={<div className="min-h-dvh bg-secondary/40" />}>
      <AdminLoginForm siteName={settings.siteName} />
    </Suspense>
  );
}
