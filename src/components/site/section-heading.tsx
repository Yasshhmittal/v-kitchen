import { cn } from "@/lib/cn";

/**
 * The eyebrow + heading + optional lead pairing every home-page section uses.
 * All three strings come from settings, so the owner rewrites section copy
 * without touching layout.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  accentEyebrow = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "center" | "left";
  accentEyebrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow && <p className={accentEyebrow ? "eyebrow-accent" : "eyebrow"}>{eyebrow}</p>}
      <h2 className={cn("section-heading text-balance", eyebrow && "mt-3")}>{title}</h2>
      {lead && <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{lead}</p>}
    </div>
  );
}
