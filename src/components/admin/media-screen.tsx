"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Copy, Loader2, Trash2, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiClientError, queryString } from "@/lib/api-client";
import { PAGE_SIZE } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/shared/toast";

interface MediaAsset {
  id: string;
  url: string;
  alt: string | null;
  folder: string;
  size: number;
  mime: string;
  createdAt: string;
}

/**
 * The media library as a screen rather than a picker.
 *
 * The `ImagePicker` dialog covers choosing an image while editing something
 * else. This is the other half of the job: renaming alt text for accessibility,
 * and clearing out photos that are no longer used. Deletes are refused by the
 * server while anything still points at the URL, so a live photo can't vanish
 * from the public site by accident.
 */
export function MediaScreen() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [folder, setFolder] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = React.useState<MediaAsset | null>(null);
  const [alt, setAlt] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 300);

  const foldersQuery = useQuery({
    queryKey: ["admin", "media", "folders"],
    queryFn: () => api.get<{ folder: string; count: number }[]>("/api/admin/media/folders"),
  });

  const listQuery = useQuery({
    queryKey: ["admin", "media", { folder, search: debouncedSearch, page }],
    queryFn: () =>
      api.getFull<MediaAsset[]>(
        `/api/admin/media${queryString({
          folder: folder || undefined,
          search: debouncedSearch || undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
  };

  React.useEffect(() => {
    setAlt(selected?.alt ?? "");
    setCopied(false);
  }, [selected]);

  const altMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api.patch<MediaAsset>(`/api/admin/media/${id}`, { alt: value }),
    onSuccess: () => {
      refresh();
      toast({ title: "Alt text saved", tone: "success" });
    },
    onError: (error) =>
      toast({
        title: error instanceof Error ? error.message : "Couldn't save the alt text.",
        tone: "error",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/media/${id}`),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      setSelected(null);
      toast({ title: "Image deleted", tone: "success" });
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder || "general");
        await api.upload<MediaAsset>("/api/admin/media", formData);
      }
      refresh();
      toast({
        title: files.length === 1 ? "Image uploaded" : `${files.length} images uploaded`,
        tone: "success",
      });
    } catch (error) {
      toast({
        title:
          error instanceof ApiClientError ? error.message : "That upload didn't go through.",
        tone: "error",
      });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const assets = listQuery.data?.data ?? [];
  const total = (listQuery.data?.meta as { total?: number } | undefined)?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every photo on the site. Upload here or from any image field.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => handleUpload(event.target.files)}
          />
          <Button disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload images
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={folder === "" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setFolder("");
            setPage(1);
          }}
        >
          All
        </Button>
        {(foldersQuery.data ?? []).map((entry) => (
          <Button
            key={entry.folder}
            variant={folder === entry.folder ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFolder(entry.folder);
              setPage(1);
            }}
          >
            {entry.folder}
            <span className="text-xs opacity-70">{entry.count}</span>
          </Button>
        ))}
      </div>

      <Input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search alt text…"
        className="max-w-sm"
      />

      {listQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">
            {search || folder ? "Nothing matches that" : "No images yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || folder
              ? "Try a different folder or clear the search."
              : "Upload a photo and it becomes available in every image field."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelected(asset)}
              aria-label={`Edit ${asset.alt || asset.url.split("/").pop()}`}
              className={`group relative aspect-square overflow-hidden rounded-xl border transition-colors hover:border-primary ${
                selected?.id === asset.id ? "border-primary ring-2 ring-primary/30" : ""
              }`}
            >
              <Image
                src={asset.url}
                alt={asset.alt || ""}
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover"
              />
              {/* Missing alt text is an accessibility bug the owner can fix in
                  ten seconds, so it's flagged on the tile rather than buried. */}
              {!asset.alt && (
                <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
                  No alt text
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount} · {total} image{total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-4 rounded-2xl border p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border">
              <Image
                src={selected.url}
                alt={selected.alt || ""}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="truncate font-mono text-xs text-muted-foreground">{selected.url}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selected.folder} · {formatBytes(selected.size)} · {selected.mime}
                </p>
              </div>
              <Field
                label="Alt text"
                htmlFor="media-alt"
                help="Describe the photo for screen readers and for when the image fails to load."
              >
                <Input
                  id="media-alt"
                  value={alt}
                  onChange={(event) => setAlt(event.target.value)}
                  placeholder="Besan laddus stacked on a brass plate"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={altMutation.isPending || alt === (selected.alt ?? "")}
              onClick={() => altMutation.mutate({ id: selected.id, value: alt })}
            >
              Save alt text
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(selected.url);
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy URL"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={() => setDeleting(selected)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this image?"
        description="The file is removed for good. If a dish, product or category still uses it, the delete is refused and you'll be told which one to update first."
        confirmLabel="Delete image"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
