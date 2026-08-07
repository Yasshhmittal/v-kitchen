"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { useToast } from "@/components/shared/toast";
import { customerProfileSchema, type CustomerProfileInput } from "@/server/validation/schemas";

/**
 * Your details.
 *
 * The phone number is shown but not editable: it is the login identity and the
 * key every past order is filed under. The server enforces that too — this form
 * simply doesn't offer a field that would be refused.
 */
export function ProfileForm({
  profile,
}: {
  profile: { name: string; phone: string; email: string | null; addressNote: string | null };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CustomerProfileInput>({
    resolver: zodResolver(customerProfileSchema),
    defaultValues: {
      name: profile.name,
      email: profile.email ?? "",
      addressNote: profile.addressNote ?? "",
    },
  });

  async function onSubmit(values: CustomerProfileInput) {
    setFormError(null);
    try {
      await api.patch("/api/account/profile", values);
      // Reset to the values just saved so the form stops reading as dirty, and
      // refresh so the greeting in the layout picks up a changed name.
      reset(values);
      router.refresh();
      toast({ title: "Details saved", tone: "success" });
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          setError(name as keyof CustomerProfileInput, { message });
        }
        return;
      }
      setFormError(error instanceof Error ? error.message : "We couldn't save that. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <Field label="Your name" htmlFor="profile-name" error={errors.name?.message} required>
        <Input id="profile-name" autoComplete="name" {...register("name")} />
      </Field>

      <Field
        label="Phone number"
        htmlFor="profile-phone"
        help="This is your sign-in number. Give us a call if it needs changing."
      >
        <Input id="profile-phone" value={profile.phone} readOnly disabled autoComplete="tel" />
      </Field>

      <Field
        label="Email"
        htmlFor="profile-email"
        error={errors.email?.message}
        help="Optional — for order receipts."
      >
        <Input id="profile-email" type="email" autoComplete="email" {...register("email")} />
      </Field>

      <Field
        label="Pickup note"
        htmlFor="profile-note"
        error={errors.addressNote?.message}
        help="Anything the kitchen should know each time, like a landmark or a preferred collection window."
      >
        <Textarea id="profile-note" rows={3} {...register("addressNote")} />
      </Field>

      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
