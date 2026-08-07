"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { Occasion } from "@prisma/client";

import { EnquirySuccess } from "@/components/site/enquiry-success";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/form-controls";
import { Input, Textarea } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api-client";
import { OCCASION_META } from "@/lib/constants";
import { bulkOrderSchema } from "@/server/validation/schemas";

/**
 * Bulk / catering enquiry.
 *
 * This is a conversation starter, not an order: quantities and prices for a
 * hundred people need a human, so the form captures the brief and the kitchen
 * replies with a quote. Only name, phone and the requirements are required —
 * anything else we can ask about when we call.
 */

type FormValues = {
  name: string;
  phone: string;
  email?: string;
  occasion: Occasion;
  occasionOther?: string;
  peopleCount?: number;
  requirements: string;
  preferredDate?: string;
  budget?: number;
  instructions?: string;
};

export function BulkOrderForm({ phone }: { phone: string }) {
  const { toast } = useToast();
  const [requestNo, setRequestNo] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(bulkOrderSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      occasion: Occasion.OTHER,
      occasionOther: "",
      requirements: "",
      preferredDate: "",
      instructions: "",
    },
  });

  const occasion = watch("occasion");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const saved = await api.post<{ requestNo: string }>("/api/bulk-orders", values);
      setRequestNo(saved.requestNo);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields) {
          for (const [field, message] of Object.entries(error.fields)) {
            setError(field as keyof FormValues, { message });
          }
        }
        toast({ tone: "error", title: "Couldn't send your enquiry", description: error.message });
      } else {
        toast({
          tone: "error",
          title: "Couldn't send your enquiry",
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
        title="Enquiry sent"
        description="We'll look at the numbers and get back to you with a quote, usually within a day."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
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
            help="Optional — useful for a written quote."
            className="sm:col-span-2"
          >
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">About the occasion</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Occasion" htmlFor="occasion" error={errors.occasion?.message}>
            {/* Radix Select is controlled, so it writes back through setValue
                rather than being registered as a native field. */}
            <Select
              value={occasion}
              onValueChange={(value) => setValue("occasion", value as Occasion)}
            >
              <SelectTrigger id="occasion">
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OCCASION_META).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {occasion === Occasion.OTHER && (
            <Field
              label="Tell us what for"
              htmlFor="occasionOther"
              error={errors.occasionOther?.message}
            >
              <Input id="occasionOther" placeholder="House party, get-together…" {...register("occasionOther")} />
            </Field>
          )}

          <Field
            label="How many people?"
            htmlFor="peopleCount"
            error={errors.peopleCount?.message}
            help="A rough number is fine."
          >
            <Input id="peopleCount" type="number" min={1} inputMode="numeric" {...register("peopleCount")} />
          </Field>

          <Field
            label="Preferred date"
            htmlFor="preferredDate"
            error={errors.preferredDate?.message}
            help="Optional."
          >
            <Input id="preferredDate" type="date" {...register("preferredDate")} />
          </Field>

          <Field
            label="Budget"
            htmlFor="budget"
            error={errors.budget?.message}
            help="Optional — helps us suggest the right spread."
          >
            <Input id="budget" type="number" min={0} step="1" inputMode="decimal" {...register("budget")} />
          </Field>
        </div>

        <div className="mt-4 space-y-4">
          <Field
            label="What would you like?"
            htmlFor="requirements"
            error={errors.requirements?.message}
            help="Dishes, sweets, namkeens — as much or as little detail as you have."
            required
          >
            <Textarea
              id="requirements"
              rows={5}
              aria-invalid={Boolean(errors.requirements)}
              {...register("requirements")}
            />
          </Field>

          <Field
            label="Anything else?"
            htmlFor="instructions"
            error={errors.instructions?.message}
            help="Allergies, spice level, packing, collection time."
          >
            <Textarea id="instructions" rows={3} {...register("instructions")} />
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
          {submitting ? "Sending…" : "Send enquiry"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          No payment now — we&apos;ll confirm the details and price with you first.
        </p>
      </div>
    </form>
  );
}
