"use client";

import * as React from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label, Switch } from "@/components/ui/form-controls";
import { ImagePicker } from "@/components/admin/image-picker";
import type { SettingEditor } from "@/server/settings/definitions";

/**
 * One editor per setting type.
 *
 * The settings screen renders itself from the registry, so this is the only
 * place that knows how a given `editor` maps to a control. Adding an editor
 * type = adding a case here.
 */
export function SettingField({
  editor,
  settingKey,
  label,
  help,
  value,
  onChange,
}: {
  editor: SettingEditor;
  settingKey: string;
  label: string;
  help?: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (editor) {
    case "boolean":
      return (
        <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <Label htmlFor={settingKey}>{label}</Label>
            {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
          </div>
          <Switch
            id={settingKey}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );

    case "image":
      return (
        <ImagePicker
          label={label}
          help={help}
          value={typeof value === "string" ? value : ""}
          onChange={(next) => onChange(next ?? "")}
          defaultFolder="site"
        />
      );

    case "imageList":
      return (
        <ImagePicker
          label={label}
          help={help}
          multiple
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(next) => onChange(next ?? [])}
          defaultFolder="site"
        />
      );

    case "textarea":
      return (
        <Field label={label} htmlFor={settingKey} help={help}>
          <Textarea
            id={settingKey}
            rows={4}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );

    case "number":
      return (
        <Field label={label} htmlFor={settingKey} help={help}>
          <Input
            id={settingKey}
            type="number"
            inputMode="decimal"
            value={value === null || value === undefined ? "" : String(value)}
            // An empty box is not zero — clearing it should leave the value
            // unset rather than silently writing 0 into a price floor.
            onChange={(event) =>
              onChange(event.target.value === "" ? "" : Number(event.target.value))
            }
          />
        </Field>
      );

    case "color":
      return (
        <Field label={label} htmlFor={settingKey} help={help}>
          <div className="flex items-center gap-2">
            <input
              id={settingKey}
              type="color"
              value={typeof value === "string" && value ? value : "#2E7D32"}
              onChange={(event) => onChange(event.target.value)}
              className="size-10 shrink-0 cursor-pointer rounded-lg border bg-background p-1"
            />
            <Input
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value)}
              className="font-mono"
            />
          </div>
        </Field>
      );

    case "openingHours":
      return <OpeningHoursEditor label={label} help={help} value={value} onChange={onChange} />;

    case "linkList":
    case "json":
      return <StructuredEditor label={label} help={help} value={value} onChange={onChange} />;

    default:
      return (
        <Field label={label} htmlFor={settingKey} help={help}>
          <Input
            id={settingKey}
            type={
              editor === "email"
                ? "email"
                : editor === "url"
                  ? "url"
                  : editor === "phone"
                    ? "tel"
                    : editor === "time"
                      ? "time"
                      : "text"
            }
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );
  }
}

type DayRow = { day: string; open: string; close: string; closed: boolean };

/**
 * Opening hours are seven fixed rows, so this is a table rather than a
 * free-form list: the owner can't add an eighth day or lose Wednesday.
 */
function OpeningHoursEditor({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const rows: DayRow[] = Array.isArray(value) ? (value as DayRow[]) : [];

  const update = (index: number, patch: Partial<DayRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      <div className="divide-y rounded-xl border">
        {rows.map((row, index) => (
          <div key={row.day} className="flex flex-wrap items-center gap-3 p-3">
            <span className="w-24 shrink-0 text-sm font-medium">{row.day}</span>
            {row.closed ? (
              <span className="flex-1 text-sm text-muted-foreground">Closed</span>
            ) : (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${row.day} opening time`}
                  value={row.open}
                  onChange={(event) => update(index, { open: event.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  aria-label={`${row.day} closing time`}
                  value={row.close}
                  onChange={(event) => update(index, { close: event.target.value })}
                  className="w-32"
                />
              </div>
            )}
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={row.closed}
                onCheckedChange={(checked) => update(index, { closed: checked })}
                aria-label={`${row.day} closed all day`}
              />
              Closed
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Lists of `{ label, href }`-ish objects — nav links, footer columns, CTAs,
 * hero highlights.
 *
 * The owner edits fields, not JSON. The shape is inferred from whatever is
 * already stored, which keeps one editor working for every list in the
 * registry; anything genuinely irregular falls back to a raw JSON box so the
 * value is still editable rather than unreachable.
 */
function StructuredEditor({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const isObjectList =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));

  const isSingleObject =
    value !== null && typeof value === "object" && !Array.isArray(value);

  const [raw, setRaw] = React.useState(() => JSON.stringify(value ?? null, null, 2));
  const [rawError, setRawError] = React.useState<string | null>(null);

  if (isObjectList) {
    const items = value as Record<string, unknown>[];
    const keys = Object.keys(items[0] ?? {});

    const update = (index: number, key: string, next: string) =>
      onChange(items.map((item, i) => (i === index ? { ...item, [key]: next } : item)));

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-2 rounded-xl border p-3">
              <GripVertical className="mt-2 size-4 shrink-0 text-muted-foreground" />
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                {keys.map((key) => (
                  <Field key={key} label={titleCase(key)} htmlFor={`${label}-${index}-${key}`}>
                    <Input
                      id={`${label}-${index}-${key}`}
                      value={typeof item[key] === "string" ? (item[key] as string) : ""}
                      onChange={(event) => update(index, key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...items, Object.fromEntries(keys.map((key) => [key, ""]))])
          }
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    );
  }

  if (isSingleObject) {
    const object = value as Record<string, unknown>;
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
        <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
          {Object.keys(object).map((key) => (
            <Field key={key} label={titleCase(key)} htmlFor={`${label}-${key}`}>
              <Input
                id={`${label}-${key}`}
                value={typeof object[key] === "string" ? (object[key] as string) : ""}
                onChange={(event) => onChange({ ...object, [key]: event.target.value })}
              />
            </Field>
          ))}
        </div>
      </div>
    );
  }

  // Empty lists and anything unusual: raw JSON, validated on every keystroke so
  // a broken value can never be saved.
  return (
    <Field label={label} help={help} error={rawError ?? undefined}>
      <Textarea
        rows={5}
        className="font-mono text-xs"
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value);
          try {
            onChange(JSON.parse(event.target.value));
            setRawError(null);
          } catch {
            setRawError("That isn't valid JSON yet — the last valid value is still saved.");
          }
        }}
      />
    </Field>
  );
}

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
