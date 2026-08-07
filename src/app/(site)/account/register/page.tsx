import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/site/page-header";
import { RegisterForm } from "@/components/site/register-form";
import { getCustomerSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an account to reorder your favourites in one tap.",
  robots: { index: false, follow: true },
};

export default async function RegisterPage() {
  if (await getCustomerSession()) redirect("/account");

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Create an account"
        lead="Ordered with us before? Use the same phone number and your past orders come with you."
        tint="sage"
      />

      <div className="section-shell py-10 lg:py-14">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-soft">
          <React.Suspense fallback={<div className="h-[34rem]" aria-hidden />}>
            <RegisterForm />
          </React.Suspense>
        </div>
      </div>
    </>
  );
}
