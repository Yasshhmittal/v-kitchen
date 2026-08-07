"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";

/**
 * Comma-separated tag input.
 *
 * The value is a string array; the user types comma-separated text which splits
 * into chips. Backspace on an empty input removes the last chip.
 */
export function TagsInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  className,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [input, setInput] = React.useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        {value.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="rounded-full hover:bg-secondary-foreground/20"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <Input
          id={id}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "," || e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            } else if (e.key === "Backspace" && input === "" && value.length > 0) {
              removeTag(value.length - 1);
            }
          }}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="h-auto min-w-[120px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}
