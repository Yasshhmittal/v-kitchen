"use client";

import * as React from "react";
import Image from "next/image";
import { Calendar, Clock, IndianRupee, Mail, Phone, User, Users } from "lucide-react";
import type { RequestStatus } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { OCCASION_META, REQUEST_STATUS_META, REQUEST_STATUS_FLOW } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import {
  Field,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/form-controls";
import { Dialog, SheetContent } from "@/components/ui/overlays";
import { useToast } from "@/components/shared/toast";
import type { RequestDetail, RequestKind } from "@/server/services/request.service";

/**
 * An enquiry is a conversation, so this drawer is a reply form rather than a
 * read-only record: the owner reads what was asked, writes the figure they
 * quoted, and moves the status. Nothing here charges anyone.
 */
export function EnquiryDetailDrawer({
  kind,
  enquiryId,
  open,
  onOpenChange,
}: {
  kind: RequestKind;
  enquiryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = React.useState<RequestStatus>("NEW");
  const [quotedAmount, setQuotedAmount] = React.useState("");
  const [adminNotes, setAdminNotes] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin", "enquiries", kind, enquiryId],
    queryFn: () => api.get<RequestDetail>(`/api/admin/enquiries/${kind}/${enquiryId}`),
    enabled: Boolean(enquiryId),
  });

  const enquiry = detailQuery.data;

  // Seed the reply form from whatever is already on the record, so reopening an
  // enquiry shows the last quote rather than a blank field.
  React.useEffect(() => {
    if (!enquiry) return;
    setStatus(enquiry.status);
    setQuotedAmount(enquiry.quotedAmount === null ? "" : String(enquiry.quotedAmount));
    setAdminNotes(enquiry.adminNotes ?? "");
    setActionError(null);
    setFieldError(null);
  }, [enquiry]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/enquiries/${kind}/${enquiryId}`, {
        status,
        quotedAmount: quotedAmount === "" ? undefined : Number(quotedAmount),
        adminNotes: adminNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "enquiries"] });
      setActionError(null);
      setFieldError(null);
      toast({ title: "Enquiry updated", tone: "success" });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Couldn't save that.";
      // The server refuses a quote with no figure; point at the field it named.
      const fields = (error as { fields?: Record<string, string> }).fields;
      setFieldError(fields?.quotedAmount ?? null);
      setActionError(fields?.quotedAmount ? null : message);
    },
  });

  if (!enquiry) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-sm text-muted-foreground">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Loading enquiry…"}
            </p>
          </div>
        </SheetContent>
      </Dialog>
    );
  }

  const meta = REQUEST_STATUS_META[enquiry.status];
  const dirty =
    status !== enquiry.status ||
    quotedAmount !== (enquiry.quotedAmount === null ? "" : String(enquiry.quotedAmount)) ||
    adminNotes !== (enquiry.adminNotes ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="flex h-full flex-col px-6 pb-6 pt-6">
          {/* Header */}
          <div className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-lg font-semibold">{enquiry.requestNo}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {enquiry.kind === "BULK" ? "Bulk enquiry" : "Custom order"} ·{" "}
                  {new Date(enquiry.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Badge variant={meta.tone}>{meta.label}</Badge>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 space-y-6 overflow-y-auto py-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </h3>
              <div className="space-y-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground" />
                  {enquiry.name}
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground" />
                  <a href={`tel:${enquiry.phone}`} className="hover:underline">
                    {enquiry.phone}
                  </a>
                </p>
                {enquiry.email && (
                  <p className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <a href={`mailto:${enquiry.email}`} className="hover:underline">
                      {enquiry.email}
                    </a>
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                What they asked for
              </h3>
              <div className="space-y-3 rounded-xl border p-4">
                {enquiry.kind === "BULK" ? (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Calendar className="size-4 text-muted-foreground" />
                        {enquiry.occasion === "OTHER" && enquiry.occasionOther
                          ? enquiry.occasionOther
                          : OCCASION_META[enquiry.occasion].label}
                      </span>
                      {enquiry.peopleCount !== null && (
                        <span className="flex items-center gap-2">
                          <Users className="size-4 text-muted-foreground" />
                          {enquiry.peopleCount} people
                        </span>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Requirements</Label>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{enquiry.requirements}</p>
                    </div>
                    {enquiry.instructions && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Extra instructions
                        </Label>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {enquiry.instructions}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">{enquiry.itemName}</p>
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{enquiry.description}</p>
                    </div>
                    {enquiry.ingredients && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Ingredients</Label>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {enquiry.ingredients}
                        </p>
                      </div>
                    )}
                    {enquiry.quantity && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Quantity</Label>
                        <p className="mt-1 text-sm">{enquiry.quantity}</p>
                      </div>
                    )}
                    {enquiry.referenceImage && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Reference photo</Label>
                        <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-lg border bg-secondary">
                          <Image
                            src={enquiry.referenceImage}
                            alt="Customer's reference photo"
                            fill
                            sizes="320px"
                            className="object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                When and how much
              </h3>
              <div className="space-y-2 rounded-xl border p-4 text-sm">
                <p className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  {enquiry.preferredDate
                    ? new Date(enquiry.preferredDate).toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "No date given"}
                </p>
                {enquiry.kind === "CUSTOM" && enquiry.preferredTime && (
                  <p className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    Around {enquiry.preferredTime}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <IndianRupee className="size-4 text-muted-foreground" />
                  {enquiry.budget !== null
                    ? `Budget ${formatCurrency(enquiry.budget)}`
                    : "No budget given"}
                </p>
              </div>
            </section>
          </div>

          {/* Footer — the reply */}
          <div className="space-y-3 border-t pt-4">
            {actionError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status" htmlFor="enquiry-status">
                <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
                  <SelectTrigger id="enquiry-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_STATUS_FLOW.map((value) => (
                      <SelectItem key={value} value={value}>
                        {REQUEST_STATUS_META[value].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Amount quoted"
                htmlFor="enquiry-quote"
                error={fieldError ?? undefined}
              >
                <Input
                  id="enquiry-quote"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>

            <Field
              label="Private notes"
              htmlFor="enquiry-notes"
              help="Only staff see this."
            >
              <Textarea
                id="enquiry-notes"
                rows={2}
                maxLength={2000}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="What you agreed, what to prep…"
              />
            </Field>

            <Button
              className="w-full"
              disabled={saveMutation.isPending || !dirty}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : dirty ? "Save reply" : "Saved"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Dialog>
  );
}
