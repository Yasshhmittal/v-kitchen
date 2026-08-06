import Image from "next/image";
import { Quote } from "lucide-react";

import { StarRating } from "./star-rating";
import { CARD_TINTS } from "@/lib/constants";
import { initials } from "@/lib/format";
import type { ReviewView } from "@/types/view";

/** Tinted testimonial card. Reviews are moderated before they reach here. */
export function TestimonialCard({ review, index = 0 }: { review: ReviewView; index?: number }) {
  const tint = CARD_TINTS[index % CARD_TINTS.length] ?? CARD_TINTS[0];

  return (
    <figure
      style={{ backgroundColor: `hsl(${tint})` }}
      className="relative flex h-full flex-col gap-4 rounded-3xl p-6 sm:p-7"
    >
      <Quote className="absolute right-6 top-6 size-8 text-foreground/[0.07]" aria-hidden />
      <StarRating rating={review.rating} />
      <blockquote className="flex-1 text-[0.9375rem] leading-relaxed text-foreground/80">
        &ldquo;{review.comment}&rdquo;
      </blockquote>
      <figcaption className="flex items-center gap-3">
        {review.image ? (
          <Image
            src={review.image}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials(review.authorName)}
          </span>
        )}
        <span className="text-sm font-semibold">{review.authorName}</span>
      </figcaption>
    </figure>
  );
}
