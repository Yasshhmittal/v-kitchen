import { PageHeader } from "@/components/site/page-header";

export interface LegalSection {
  heading: string;
  text: string;
}

/**
 * Shared shell for the privacy and terms pages. Both are just a title and a
 * list of sections pulled from settings, so the owner rewrites the wording
 * without a deploy.
 */
export function LegalPage({
  title,
  sections,
  updatedAt,
}: {
  title: string;
  sections: LegalSection[];
  updatedAt?: string;
}) {
  return (
    <>
      <PageHeader eyebrow="The small print" title={title} tint="none" />

      <div className="section-shell py-10 lg:py-14">
        <article className="mx-auto max-w-2xl">
          {updatedAt && (
            <p className="text-xs text-muted-foreground">Last updated {updatedAt}</p>
          )}

          <div className="mt-6 space-y-8">
            {sections.map((section, index) => (
              <section key={section.heading}>
                <h2 className="text-base font-semibold">
                  <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                  {section.heading}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {section.text}
                </p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </>
  );
}
