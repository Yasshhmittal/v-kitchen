"use client";

import * as React from "react";
import { useForm, Controller, type FieldValues, type Path, type PathValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ZodType } from "zod";

import { cn } from "@/lib/cn";
import { ApiClientError } from "@/lib/api-client";
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
  Checkbox,
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

/**
 * The create/edit dialog behind every admin CRUD screen.
 *
 * You describe the fields declaratively and hand over the same Zod schema the
 * API validates with — so the form and the server can never disagree about what
 * a valid record looks like. Submitting calls `onSubmit`; if that throws an
 * ApiClientError carrying `fields`, those land on the matching inputs and
 * anything else shows as a banner above the buttons.
 *
 * The parent owns open/close and refreshing its list. This component only
 * collects and validates.
 */

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "password"
  | "number"
  | "textarea"
  | "select"
  | "switch"
  | "checkbox"
  | "image"
  | "date"
  | "time";

export interface FieldDef<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  disabled?: boolean;
  /** Options for `select`. Values are compared as strings. */
  options?: Array<{ value: string; label: string }>;
  /** Numeric constraints for `number`. */
  min?: number;
  max?: number;
  step?: number;
  /** Rows for `textarea`. */
  rows?: number;
  /** Allow several images for `image`. The field value becomes `string[]`. */
  multiple?: boolean;
  /** Upload folder for `image` — keeps the media library tidy. */
  folder?: string;
  /** Span both columns in a two-column layout. Ignored when `columns` is 1. */
  full?: boolean;
  /** Render only when this returns true, e.g. a field that depends on another. */
  when?: (values: T) => boolean;
}

export interface CrudFormProps<T extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef<T>[];
  schema: ZodType<T>;
  defaultValues: T;
  /** Persist the record. Throw to keep the dialog open and show the error. */
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Two columns on wider screens — worth it for forms with many short fields. */
  columns?: 1 | 2;
}

export function CrudForm<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  fields,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  size = "lg",
  columns = 1,
}: CrudFormProps<T>) {
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
  } = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as never,
  });

  // Opening for a different record has to repopulate the inputs — react-hook-form
  // only reads defaultValues once, so an explicit reset is required.
  React.useEffect(() => {
    if (open) {
      reset(defaultValues as never);
      setFormError(null);
    }
  }, [open, defaultValues, reset]);

  const values = watch();

  async function handleFormSubmit(data: T) {
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit(data);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        for (const [name, message] of Object.entries(error.fields)) {
          setError(name as Path<T>, { type: "server", message });
        }
        // Field errors are visible inline; a banner on top would be noise.
        setFormError(
          Object.keys(error.fields).length > 0 ? null : error.message,
        );
      } else {
        setFormError(
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const visible = fields.filter((field) => !field.when || field.when(values));

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-col">
          <DialogBody>
            <div
              className={cn(
                "grid gap-5",
                columns === 2 && "sm:grid-cols-2",
              )}
            >
              {visible.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  register={register}
                  control={control}
                  error={errorFor(errors, field.name)}
                  className={cn(columns === 2 && field.full && "sm:col-span-2")}
                />
              ))}
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

/* -------------------------------------------------------------------------- */

function FormField<T extends FieldValues>({
  field,
  register,
  control,
  error,
  className,
}: {
  field: FieldDef<T>;
  register: ReturnType<typeof useForm<T>>["register"];
  control: ReturnType<typeof useForm<T>>["control"];
  error?: string;
  className?: string;
}) {
  const invalid = error ? "true" : undefined;

  // The picker draws its own label, help text and error, so wrapping it in a
  // Field would print the label twice.
  if (field.type === "image") {
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: controlled }) => (
          <ImagePicker
            value={controlled.value as string | string[] | undefined}
            onChange={controlled.onChange}
            multiple={field.multiple}
            label={field.label}
            help={field.help}
            error={error}
            defaultFolder={field.folder}
            disabled={field.disabled}
            className={className}
          />
        )}
      />
    );
  }

  // A switch reads better with the label beside the control rather than above it.
  if (field.type === "switch") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
            </label>
            {field.help && (
              <p className="mt-0.5 text-xs text-muted-foreground">{field.help}</p>
            )}
          </div>
          <Controller
            name={field.name}
            control={control}
            render={({ field: controlled }) => (
              <Switch
                id={field.name}
                checked={Boolean(controlled.value)}
                onCheckedChange={controlled.onChange}
                disabled={field.disabled}
              />
            )}
          />
        </div>
        {error && (
          <p className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-start gap-3">
          <Controller
            name={field.name}
            control={control}
            render={({ field: controlled }) => (
              <Checkbox
                id={field.name}
                checked={Boolean(controlled.value)}
                onCheckedChange={controlled.onChange}
                disabled={field.disabled}
                className="mt-0.5"
              />
            )}
          />
          <div className="min-w-0">
            <label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
            </label>
            {field.help && (
              <p className="mt-0.5 text-xs text-muted-foreground">{field.help}</p>
            )}
          </div>
        </div>
        {error && (
          <p className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Field
      label={field.label}
      htmlFor={field.name}
      help={field.help}
      error={error}
      required={field.required}
      className={className}
    >
      {field.type === "select" ? (
        <Controller
          name={field.name}
          control={control}
          render={({ field: controlled }) => (
            <Select
              value={controlled.value == null ? "" : String(controlled.value)}
              onValueChange={controlled.onChange}
              disabled={field.disabled}
            >
              <SelectTrigger id={field.name} aria-invalid={invalid}>
                <SelectValue placeholder={field.placeholder ?? "Select…"} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      ) : field.type === "textarea" ? (
        <Textarea
          id={field.name}
          rows={field.rows}
          placeholder={field.placeholder}
          disabled={field.disabled}
          aria-invalid={invalid}
          {...register(field.name)}
        />
      ) : field.type === "number" ? (
        <Input
          id={field.name}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          placeholder={field.placeholder}
          disabled={field.disabled}
          aria-invalid={invalid}
          // An empty numeric input yields NaN, which Zod reports as a confusing
          // "expected number, received nan". undefined lets optional fields clear.
          {...register(field.name, {
            setValueAs: (raw) =>
              raw === "" || raw === null
                ? undefined
                : (Number(raw) as PathValue<T, Path<T>>),
          })}
        />
      ) : (
        <Input
          id={field.name}
          type={field.type}
          placeholder={field.placeholder}
          disabled={field.disabled}
          aria-invalid={invalid}
          {...register(field.name)}
        />
      )}
    </Field>
  );
}

/**
 * Read a possibly-nested error message. `errors` is keyed by path segment, so
 * "images.0.url" has to be walked rather than looked up directly.
 */
function errorFor(errors: unknown, path: string): string | undefined {
  let node: unknown = errors;
  for (const segment of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}
