"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole } from "lucide-react";

import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { adminLoginSchema, type AdminLoginInput } from "@/server/validation/schemas";

/**
 * Staff sign-in.
 *
 * On success the server sets HttpOnly cookies and we do a full `router.refresh`
 * before navigating, so the guarded layout re-renders server-side with the new
 * session rather than trusting client state.
 */
export function AdminLoginForm({ siteName }: { siteName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError("");
    try {
      await api.post("/api/admin/auth/login", values);

      // `next` comes from the middleware redirect. Only relative paths are
      // honoured — an absolute URL here would be an open redirect.
      const next = searchParams.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";

      router.replace(destination);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, message] of Object.entries(error.fields)) {
            setError(field as keyof AdminLoginInput, { message });
          }
        }
        setFormError(error.message);
      } else {
        setFormError("Couldn't sign in. Check your connection and try again.");
      }
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" />
          </span>
          <h1 className="text-xl font-bold">{siteName} admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage menus, orders and settings.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border bg-background p-6 shadow-soft"
          noValidate
        >
          {formError && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {formError}
            </p>
          )}

          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
          </Field>

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Staff access only. Customers sign in from the main site.
        </p>
      </div>
    </div>
  );
}
