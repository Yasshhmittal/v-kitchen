"use client";

import * as React from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { SettingField } from "@/components/admin/setting-field";
import { useToast } from "@/components/shared/toast";
import type { SettingDefinition, SettingGroup } from "@/server/settings/definitions";

interface SettingsPayload {
  groups: readonly { id: SettingGroup; label: string; description: string }[];
  definitions: (SettingDefinition & { value: unknown })[];
}

/**
 * Site settings.
 *
 * The screen is generated from the server's setting registry — it has no
 * knowledge of individual keys. Adding an editable field to the site is one
 * entry in `server/settings/definitions.ts`; it appears here automatically.
 */
export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [group, setGroup] = React.useState<SettingGroup>("brand");
  // Only what the owner actually touched is sent, so two people editing
  // different tabs don't overwrite each other's untouched fields.
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<SettingsPayload>("/api/admin/settings"),
  });

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.patch("/api/admin/settings", { values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      setDraft({});
      toast({
        title: "Settings saved",
        description: "The site is updated — no deploy needed.",
        tone: "success",
      });
    },
    onError: (error) =>
      toast({
        title: error instanceof Error ? error.message : "Couldn't save the settings.",
        tone: "error",
      }),
  });

  const payload = settingsQuery.data;
  const dirtyCount = Object.keys(draft).length;

  const valueFor = (definition: SettingDefinition & { value: unknown }) =>
    definition.key in draft ? draft[definition.key] : definition.value;

  if (settingsQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (settingsQuery.error || !payload) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
        <p className="text-sm">
          {settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : "Couldn't load the settings."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => settingsQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const activeGroup = payload.groups.find((entry) => entry.id === group);
  const fields = payload.definitions.filter((definition) => definition.group === group);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything on the public site, editable here — no deploy, no developer.
        </p>
      </div>

      <Tabs value={group} onValueChange={(value) => setGroup(value as SettingGroup)}>
        <TabsList>
          {payload.groups.map((entry) => {
            const changed = payload.definitions.filter(
              (definition) => definition.group === entry.id && definition.key in draft,
            ).length;
            return (
              <TabsTrigger key={entry.id} value={entry.id}>
                {entry.label}
                {/* A dot on the tab, so edits parked on another tab aren't
                    forgotten when the owner saves from here. */}
                {changed > 0 && (
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {activeGroup && (
        <p className="text-sm text-muted-foreground">{activeGroup.description}</p>
      )}

      <div className="space-y-5 rounded-2xl border p-5">
        {fields.map((definition) => (
          <SettingField
            key={definition.key}
            editor={definition.editor}
            settingKey={definition.key}
            label={definition.label}
            help={definition.help}
            value={valueFor(definition)}
            onChange={(next) =>
              setDraft((current) => ({ ...current, [definition.key]: next }))
            }
          />
        ))}
      </div>

      {/* The only save affordance, and it follows the owner down a long form.
          Nothing dirty means nothing to save, so the bar stays out of the way. */}
      {dirtyCount > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => setDraft({})}
            >
              <RotateCcw className="size-4" />
              Discard
            </Button>
            <Button
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
