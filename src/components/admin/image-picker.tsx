"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Search, FolderOpen, X, Loader2, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import { api, ApiClientError, queryString } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/overlays";

/** Images per page in the library grid. */
const PER_PAGE = 24;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaAsset {
  id: string;
  url: string;
  alt: string | null;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

interface FolderCount {
  folder: string;
  count: number;
}

export interface ImagePickerProps {
  /** Current image URL(s). A string for single-select, string[] for multi. */
  value?: string | string[];
  /** Called with the selected URL(s) — same shape as `value`. */
  onChange: (value: string | string[] | undefined) => void;
  /** Allow selecting multiple images. Defaults to false. */
  multiple?: boolean;
  /** Show a label above the picker. */
  label?: string;
  /** Help text. */
  help?: string;
  /** Error message (passed in from form validation). */
  error?: string;
  /** Upload will go into this folder. Defaults to "general". */
  defaultFolder?: string;
  /** Disabled state. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable image picker for admin forms.
 *
 * Clicking the placeholder or a thumbnail opens the media library in a dialog.
 * From there the user can browse, search, filter by folder, upload a new image,
 * and click to select — all without leaving the form.
 *
 * Shape of the value (string vs string[]) is determined by the `multiple` prop.
 */
export function ImagePicker({
  value,
  onChange,
  multiple = false,
  label,
  help,
  error,
  defaultFolder = "general",
  disabled = false,
}: ImagePickerProps) {
  const urls = multiple
    ? (Array.isArray(value) ? value : value ? [value] : ([] as string[]))
    : typeof value === "string"
      ? [value]
      : ([] as string[]);

  return (
    <Field label={label} help={help} error={error}>
      <div className="flex flex-wrap gap-3">
        {!disabled && (
          <LibraryDialog
            urls={urls}
            folder={defaultFolder}
            multiple={multiple}
            onSelect={(selected) => {
              if (multiple) {
                const updated = new Set(urls);
                if (updated.has(selected)) {
                  updated.delete(selected);
                } else {
                  updated.add(selected);
                }
                onChange(Array.from(updated));
              } else {
                onChange(urls[0] === selected ? undefined : selected);
              }
            }}
          />
        )}
        {urls.map((url) => (
          <Thumb key={url} url={url} onRemove={disabled ? undefined : () => removeOne(url, urls, multiple, onChange)} />
        ))}
      </div>
    </Field>
  );
}

function removeOne(
  url: string,
  urls: string[],
  multiple: boolean,
  onChange: ImagePickerProps["onChange"],
) {
  if (multiple) {
    onChange(urls.filter((u) => u !== url));
  } else {
    onChange(undefined);
  }
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function Thumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <div className="group relative size-24 overflow-hidden rounded-xl border bg-secondary">
      <Image src={url} alt="" fill sizes="96px" className="object-cover" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload trigger — shown alongside the "Browse library" trigger
// ---------------------------------------------------------------------------

function UploadTrigger({
  folder,
  onUploaded,
}: {
  folder: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const upload = async (file: File) => {
    setBusy(true);
    setMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const asset = await api.upload<MediaAsset>("/api/admin/media", formData);
      onUploaded(asset.url);
    } catch (error) {
      setMsg(error instanceof ApiClientError ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex size-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary",
          busy && "pointer-events-none opacity-50",
        )}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        <span className="text-[0.625rem] font-medium uppercase tracking-wide">
          {busy ? "Uploading…" : "Upload"}
        </span>
      </button>
      {msg && <p className="mt-1 text-xs text-destructive">{msg}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Library dialog
// ---------------------------------------------------------------------------

function LibraryDialog({
  urls,
  folder,
  multiple,
  onSelect,
}: {
  urls: string[];
  folder: string;
  multiple: boolean;
  onSelect: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<FolderCount[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, meta } = await api.getFull<MediaAsset[]>(
        `/api/admin/media${queryString({ folder: activeFolder || undefined, search: debouncedSearch || undefined, page, pageSize: PER_PAGE })}`,
      );
      setAssets(data);
      setTotal(meta?.total ?? data.length);
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : "Failed to load library.");
    } finally {
      setLoading(false);
    }
  }, [activeFolder, debouncedSearch, page]);

  const fetchFolders = useCallback(async () => {
    try {
      const result = await api.get<FolderCount[]>("/api/admin/media/folders");
      setFolders(result);
    } catch {
      // Non-critical — the chips just won't show folder counts.
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFolders();
      fetchAssets();
    }
  }, [open, fetchFolders, fetchAssets]);

  const handleUploaded = useCallback(
    (url: string) => {
      onSelect(url);
      fetchAssets();
      fetchFolders();
      // Single-select is done as soon as something is chosen; multi-select
      // stays open so the user can keep picking.
      if (!multiple) setOpen(false);
    },
    [onSelect, fetchAssets, fetchFolders, multiple],
  );

  const handleSelect = useCallback(
    (url: string) => {
      onSelect(url);
      if (!multiple) setOpen(false);
    },
    [onSelect, multiple],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus className="size-5" />
          <span className="text-[0.625rem] font-medium uppercase tracking-wide">Add image</span>
        </button>
      </DialogTrigger>

      <DialogContent size="xl" className="h-[85dvh]">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            {multiple
              ? "Click an image to add it. Click again to remove it."
              : "Click an image to select it."}
          </DialogDescription>

          {/* Search */}
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search alt text…"
                className="h-10 pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <UploadTrigger folder={activeFolder || folder} onUploaded={handleUploaded} />
          </div>

          {/* Folder chips */}
          {folders.length > 1 && (
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveFolder("");
                  setPage(1);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeFolder === ""
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                <FolderOpen className="mr-1 inline size-3" />
                All ({folders.reduce((sum, f) => sum + f.count, 0)})
              </button>
              {folders.map((f) => (
                <button
                  type="button"
                  key={f.folder}
                  onClick={() => {
                    setActiveFolder(f.folder);
                    setPage(1);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    activeFolder === f.folder
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.folder} ({f.count})
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        <DialogBody className="!p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchAssets}>
                Retry
              </Button>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <FolderOpen className="size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {search ? "Nothing matches that search." : "No images yet. Upload one to get started."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {assets.map((asset) => {
                  const selected = urls.includes(asset.url);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleSelect(asset.url)}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-xl border-2 bg-secondary transition-all",
                        selected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/30",
                      )}
                    >
                      <Image
                        src={asset.url}
                        alt={asset.alt ?? ""}
                        fill
                        sizes="(min-width: 1280px) 160px, (min-width: 640px) 128px, 96px"
                        className="object-cover"
                      />
                      {selected && (
                        <span className="absolute inset-0 flex items-center justify-center bg-primary/15">
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold text-primary-foreground shadow">
                            Selected
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Pagination */}
              {total > PER_PAGE && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {page} of {Math.ceil(total / PER_PAGE)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * PER_PAGE >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
