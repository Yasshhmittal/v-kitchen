"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";

import { cn } from "@/lib/cn";
import { useFavourites, type FavouriteTarget } from "@/hooks/use-favourites";
import { useToast } from "@/components/shared/toast";

/**
 * The heart on a dish or product card.
 *
 * Guests aren't shown a dead control: tapping sends them to sign-in with a
 * `next` back to the page they were on, so they land where they left off. All
 * hearts on a page share one query, so this costs no extra request per card.
 */
export function FavouriteButton({
  name,
  target,
  className,
}: {
  name: string;
  target: FavouriteTarget;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { isSignedIn, isFavourite, toggle } = useFavourites();

  const saved = isSignedIn && isFavourite(target);
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    if (!isSignedIn) {
      router.push(`/account/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setPending(true);
    try {
      const result = await toggle(target);
      toast({
        title: result.favourited ? `Saved ${name}` : `Removed ${name} from favourites`,
        tone: "success",
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Couldn't save that.",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-soft backdrop-blur transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        saved && "text-destructive",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-current")} aria-hidden />
    </button>
  );
}
