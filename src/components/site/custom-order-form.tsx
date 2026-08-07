"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";

import { EnquirySuccess } from "@/components/site/enquiry-success";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api-client";
import { customOrderSchema } from "@/server/validation/schemas";

/**
 * Custom order enquiry — "can you make me X?"
 *
 * Kept short on purpose. What the item is and how to reach you are required;
 * ingredients, quantity and timing are all optional, because someone asking
 * for a sugar-free laddu box often doesn't know the rest yet.
 */

type FormValues = {
  name: string;
  phone: string;
  email?: string;
  itemName: string;
  description: string;
  ingredients?: string;
  quantity?: string;
  preferredDate?: string;
  preferredTime?: string;
  budget?: number;
};

export function CustomOrderForm({ phone }: { phone: string }) {
  const { toast } = useToast();
  const [requestNo, setRequestNo] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(customOrderSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      itemName: "",
      description: "",
      ingredients: "",
      quantity: "",
      preferredDate: "",
      preferredTime: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const saved = await api.post<{ requestNo: string }>("/api/custom-orders", values);
      setRequestNo(saved.requestNo);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, message] of Object.entries(error.fields)) {
            setError(field as keyof FormValues, { message });
          }
        }
        toast({ tone: "error", title: "Couldn't send your request", description: error.message });
      } else {
        toast({
          tone: "error",
          title: "Couldn't send your request",
          description: "Please check your connection and try again.",
        });
      }
      setSubmitting(false);
    }
  }

  if (requestNo) {
    return (
      <EnquirySuccess
        requestNo={requestNo}
        phone={phone}
        title="Request sent"
        description="We'll check whether we can make it and call you back with a price and a date."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold">What would you like us to make?</h2>

        <div className="mt-5 space-y-4">
          <Field label="Item" htmlFor="itemName" error={errors.itemName?.message} required>
            <Input
              id="itemName"
              placeholder="Sugar-free besan laddu, jain thali, gift box…"
              aria-invalid={Boolean(errors.itemName)}
              {...register("itemName")}
            />
          </Field>

          <Field
            label="Describe it"
            htmlFor="description"
            error={errors.description?.message}
            help="Taste, size, how it should look — whatever you have in mind."
            required
          >
            <Textarea
              id="description"
              rows={5}
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
          </Field>

          <Field
            label="Ingredients to include or avoid"
            htmlFor="ingredients"
            error={errors.ingredients?.message}
            help="Allergies, dietary needs, anything to leave out."
          >
            <Textarea id="ingredients" rows={3} {...register("ingredients")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Quantity and timing</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="How much?"
            htmlFor="quantity"
            error={errors.quantity?.message}
            help="e.g. 2 kg, 50 pieces, 3 boxes."
          >
            <Input id="quantity" {...register("quantity")} />
          </Field>

          <Field
            label="Budget"
            htmlFor="budget"
            error={errors.budget?.message}
            help="Optional."
          >
            <Input id="budget" type="number" min={0} step="1" inputMode="decimal" {...register("budget")} />
          </Field>

          <Field label="Needed by" htmlFor="preferredDate" error={errors.preferredDate?.message}>
            <Input id="preferredDate" type="date" {...register("preferredDate")} />
          </Field>

          <Field
            label="Preferred pickup time"
            htmlFor="preferredTime"
            error={errors.preferredTime?.message}
          >
            <Input id="preferredTime" type="time" {...register("preferredTime")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">How can we reach you?</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
          </Field>

          <Field label="Phone number" htmlFor="phone" error={errors.phone?.message} required>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              {...register("phone")}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            error={errors.email?.message}
            help="Optional."
            className="sm:col-span-2"
          >
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          {submitting ? "Sending…" : "Send request"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll confirm what&apos;s possible and agree a price before anything is made.
        </p>
      </div>
    </form>
  );
}
