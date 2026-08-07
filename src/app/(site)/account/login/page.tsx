import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/site/page-header";
import { LoginForm } from "@/components/site/login-form";
import { getCustomerSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to see your orders and saved favourites.",
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  // Already signed in — the sign-in form would be a dead end.
  if (await getCustomerSession()) redirect("/account");

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Sign in"
        lead="See your past orders, reorder in one tap, and keep your favourites."
        tint="sage"
      />

      <div className="section-shell py-10 lg:py-14">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-soft">
          {/* useSearchParams needs a Suspense boundary to keep the shell static. */}
          <React.Suspense fallback={<div className="h-80" aria-hidden />}>
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </>
  );
}
