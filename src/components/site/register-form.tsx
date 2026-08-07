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
import { customerRegisterSchema, type CustomerRegisterInput } from "@/server/validation/schemas";

/**
 * Create an account.
 *
 * The phone number is the identity: if it already has guest orders against it,
 * registering claims that history rather than starting from zero. The server
 * does the claiming; the form just needs to not get in the way.
 */
export function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";

  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerRegisterInput>({
    resolver: zodResolver(customerRegisterSchema),
    defaultValues: { name: "", phone: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: CustomerRegisterInput) {
    setFormError(null);
    try {
      await api.post("/api/auth/register", values);
      window.location.assign(next);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          setError(name as keyof CustomerRegisterInput, { message });
        }
        return;
      }
      setFormError(
        error instanceof Error ? error.message : "We couldn't create your account. Please try again.",
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

      <Field label="Your name" htmlFor="register-name" error={errors.name?.message} required>
        <Input id="register-name" autoComplete="name" placeholder="Anita Desai" {...register("name")} />
      </Field>

      <Field
        label="Phone number"
        htmlFor="register-phone"
        error={errors.phone?.message}
        help="We'll call this number when your order is ready to collect."
        required
      >
        <Input
          id="register-phone"
          type="tel"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="9876543210"
          {...register("phone")}
        />
      </Field>

      <Field
        label="Email"
        htmlFor="register-email"
        error={errors.email?.message}
        help="Optional — for order receipts."
      >
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("email")}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="register-password"
        error={errors.password?.message}
        help="At least 8 characters."
        required
      >
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="register-confirm"
        error={errors.confirmPassword?.message}
        required
      >
        <Input
          id="register-confirm"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/account/login${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
