import { AlertCircle } from "lucide-react";

/**
 * Shown site-wide when the owner switches "Accept online orders" off. The site
 * stays fully browsable — only the ordering actions are withdrawn.
 */
export function OrderingPausedBanner({ message }: { message: string }) {
  return (
    <div role="status" className="bg-warning/15 text-warning-foreground dark:text-warning">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium sm:px-6 lg:px-8">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        <span>{message}</span>
      </div>
    </div>
  );
}
