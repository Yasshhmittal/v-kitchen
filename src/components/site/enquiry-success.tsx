import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Shown after a bulk or custom order enquiry is saved. The reference number is
 * the customer's handle on the conversation, so it leads.
 */
export function EnquirySuccess({
  requestNo,
  title,
  description,
  phone,
}: {
  requestNo: string;
  title: string;
  description: string;
  phone?: string;
}) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15">
        <CheckCircle2 className="size-7 text-success" aria-hidden />
      </div>

      <h2 className="mt-5 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-pretty text-sm text-muted-foreground">{description}</p>

      <div className="mt-6 rounded-xl bg-secondary/70 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your reference</p>
        <p className="mt-1 text-lg font-bold tabular-nums">{requestNo}</p>
      </div>

      {phone && (
        <p className="mt-4 text-sm text-muted-foreground">
          In a hurry? Call us on{" "}
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="font-semibold text-foreground underline underline-offset-2"
          >
            {phone}
          </a>
          .
        </p>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/menu">Browse the menu</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </Card>
  );
}
