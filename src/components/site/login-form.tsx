"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { customerLoginSchema, type CustomerLoginInput } from "@/server/validation/schemas";

/**
 * Customer sign-in.
 *
 * Signing in is optional here — guest checkout stays open — so this screen
 * says what an account is *for* rather than treating it as a toll gate.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  // Where to land afterwards, e.g. a "sign in to save this" link from checkout.
  const next = searchParams.get("next") || "/account";

  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerLoginInput>({
    resolver: zodResolver(customerLoginSchema),
    defaultValues: { phone: "", password: "" },
  });

  async function onSubmit(values: CustomerLoginInput) {
    setFormError(null);
    try {
      await api.post("/api/auth/login", values);
      // A full navigation, not a client push: the layout reads the session on
      // the server, so it has to re-render for the header to know who you are.
      window.location.assign(next);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          setError(name as keyof CustomerLoginInput, { message });
        }
        return;
      }
      setFormError(
        error instanceof Error ? error.message : "We couldn't sign you in. Please try again.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      )}

      <Field label="Phone number" htmlFor="login-phone" error={errors.phone?.message} required>
        <Input
          id="login-phone"
          type="tel"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="9876543210"
          {...register("phone")}
        />
      </Field>

      <Field label="Password" htmlFor="login-password" error={errors.password?.message} required>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={`/account/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Ordered as a guest?{" "}
        <Link href="/track" className="font-medium text-primary hover:underline">
          Track that order
        </Link>{" "}
        with your order number.
      </p>
    </form>
  );
}
