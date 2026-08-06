import { cn } from "@/lib/cn";

/**
 * Standard page header for every inner page — a coloured band with the title
 * and a short lead, so pages read consistently without repeating markup.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  tint = "green",
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  tint?: "green" | "cream" | "peach" | "sage" | "none";
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "border-b border-border/60",
        tint !== "none" && "bg-[hsl(var(--tint-green))]",
      )}
      style={tint !== "none" ? { backgroundColor: `hsl(var(--tint-${tint}))` } : undefined}
    >
      <div className="section-shell py-10 lg:py-14">
        {eyebrow && <p className="eyebrow-accent">{eyebrow}</p>}
        <h1
          className={cn(
            "font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl",
            eyebrow && "mt-3",
          )}
        >
          {title}
        </h1>
        {lead && <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">{lead}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </header>
  );
}
