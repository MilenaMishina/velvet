/**
 * Shared layout for the legal / policy pages.
 *
 * Adult aggregation carries real legal surface — DMCA handling, 18 U.S.C. §2257
 * notices, a privacy policy, terms. Every aggregator that outgrew a hobby has
 * these pages; every one that did not, did not outgrow a hobby. One component
 * keeps them consistent and styled.
 */
export interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export default function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated?: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-primary">Legal</p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-pretty sm:text-4xl">{title}</h1>
        {updated ? <p className="text-xs text-foreground-subtle">Last updated {updated}</p> : null}
        <div aria-hidden className="hairline h-px w-full" />
      </header>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-foreground-muted">
                {paragraph}
              </p>
            ))}
            {section.list ? (
              <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed text-foreground-muted">
                {section.list.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
