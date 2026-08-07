"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { MenuSlot } from "@prisma/client";

import { ApiClientError } from "@/lib/api-client";
import { MENU_SLOT_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui/form-controls";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/overlays";
import { ImagePicker } from "@/components/admin/image-picker";
import { MenuComposer, type ComposerEntry } from "@/components/admin/menu-composer";
import { menuSchema, type MenuInput } from "@/server/validation/schemas";

/**
 * Create/edit dialog for a menu.
 *
 * Menus don't fit CrudForm's declarative fields: composing one means picking
 * dishes from the catalogue, each with its own price override and order. So
 * this is a purpose-built form — the settings above, the composer below.
 */

/** The form's own shape. `entries` carries display data the schema strips. */
export interface MenuFormValues extends Omit<MenuInput, "date" | "publishAt" | "entries"> {
  /** `yyyy-MM-dd`, or "" for a recurring menu. */
  date: string;
  /** `yyyy-MM-ddTHH:mm`, or "" to publish immediately. */
  publishAt: string;
  entries: ComposerEntry[];
}

export const EMPTY_MENU: MenuFormValues = {
  title: "",
  subtitle: "",
  slot: "MORNING",
  date: "",
  dayOfWeek: undefined,
  bannerImage: "",
  orderCutoffTime: "",
  publishAt: "",
  isActive: true,
  sortOrder: 0,
  entries: [],
};

const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function MenuEditor({
  open,
  onOpenChange,
  title,
  defaultValues,
  onSubmit,
  submitLabel = "Save menu",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultValues: MenuFormValues;
  onSubmit: (values: MenuInput) => Promise<void>;
  submitLabel?: string;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<MenuFormValues>({
    // The schema is the API's, so the form can't accept what the server refuses.
    resolver: zodResolver(menuSchema) as never,
    defaultValues,
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultValues);
      setFormError(null);
    }
  }, [open, defaultValues, reset]);

  // A date pins the menu to one day, which makes the weekday rule meaningless.
  const pinnedDate = watch("date");

  async function handleFormSubmit(data: MenuFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit(menuSchema.parse(data));
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          setError(name as keyof MenuFormValues, { type: "server", message });
        }
        setFormError(Object.keys(error.fields).length > 0 ? null : error.message);
      } else {
        setFormError(
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pin it to a date, repeat it weekly, or leave both blank for an always-on menu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-col">
          <DialogBody>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Title"
                htmlFor="title"
                required
                error={errors.title?.message}
                className="sm:col-span-2"
              >
                <Input id="title" placeholder="Monday Breakfast" {...register("title")} />
              </Field>

              <Field
                label="Subtitle"
                htmlFor="subtitle"
                help="A short line shown under the title"
                error={errors.subtitle?.message}
                className="sm:col-span-2"
              >
                <Textarea id="subtitle" rows={2} {...register("subtitle")} />
              </Field>

              <Field label="Slot" htmlFor="slot" required error={errors.slot?.message}>
                <Controller
                  name="slot"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="slot">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(MenuSlot).map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {MENU_SLOT_META[slot].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Order cutoff"
                htmlFor="orderCutoffTime"
                help="Orders refused after this time"
                error={errors.orderCutoffTime?.message}
              >
                <Input id="orderCutoffTime" type="time" {...register("orderCutoffTime")} />
              </Field>

              <Field
                label="Date"
                htmlFor="date"
                help="Leave blank to repeat instead of pinning to one day"
                error={errors.date?.message}
              >
                <Input id="date" type="date" {...register("date")} />
              </Field>

              <Field
                label="Repeats on"
                htmlFor="dayOfWeek"
                help={
                  pinnedDate
                    ? "Ignored while a date is set"
                    : "Pick a weekday for a recurring menu"
                }
                error={errors.dayOfWeek?.message}
              >
                <Controller
                  name="dayOfWeek"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value === undefined ? "any" : String(field.value)}
                      onValueChange={(value) =>
                        field.onChange(value === "any" ? undefined : Number(value))
                      }
                      disabled={Boolean(pinnedDate)}
                    >
                      <SelectTrigger id="dayOfWeek">
                        <SelectValue placeholder="Every day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Every day</SelectItem>
                        {DAYS.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Publish at"
                htmlFor="publishAt"
                help="Leave blank to go live as soon as it's active"
                error={errors.publishAt?.message}
              >
                <Input id="publishAt" type="datetime-local" {...register("publishAt")} />
              </Field>

              <Field
                label="Sort order"
                htmlFor="sortOrder"
                help="Lower shows first"
                error={errors.sortOrder?.message}
              >
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  {...register("sortOrder", {
                    setValueAs: (raw) => (raw === "" || raw === null ? 0 : Number(raw)),
                  })}
                />
              </Field>

              <Controller
                name="bannerImage"
                control={control}
                render={({ field }) => (
                  <ImagePicker
                    value={field.value}
                    onChange={field.onChange}
                    label="Banner image"
                    help="Shown at the top of this menu"
                    error={errors.bannerImage?.message}
                    defaultFolder="menus"
                    className="sm:col-span-2"
                  />
                )}
              />

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div className="min-w-0">
                    <label htmlFor="isActive" className="text-sm font-medium">
                      Active
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Turn off to keep it as a draft, hidden from the site
                    </p>
                  </div>
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <Controller
                  name="entries"
                  control={control}
                  render={({ field }) => (
                    <MenuComposer
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.entries?.message}
                    />
                  )}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            {formError && (
              <p
                role="alert"
                className="mr-auto flex items-center gap-2 text-sm font-medium text-destructive"
              >
                <AlertCircle className="size-4 shrink-0" />
                {formError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
