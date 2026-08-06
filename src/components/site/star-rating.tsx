import { Star } from "lucide-react";

import { cn } from "@/lib/cn";

/** Orange star rating, matching the reference testimonial cards. */
export function StarRating({
  rating,
  className,
  size = "sm",
}: {
  rating: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const rounded = Math.round(rating);
  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            size === "sm" ? "size-4" : "size-5",
            index < rounded ? "fill-accent text-accent" : "text-muted-foreground/30",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}
