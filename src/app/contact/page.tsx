import { Mail, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the operator: takedowns, feedback, and business.',
};

/**
 * Contact page.
 *
 * TODO(operator): replace the placeholder mailbox below with the real inbox
 * before taking the site public — a contact page that cannot receive mail is
 * worse than none. A free catch-all (Cloudflare Email Routing, ForwardEmail)
 * on the site's domain takes two minutes to set up.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-primary">Contact</p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-pretty sm:text-4xl">Talk to us</h1>
        <div aria-hidden className="hairline h-px w-full" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="mailto:takedowns@example.com"
          className="panel group rounded-card p-6 transition-all duration-300 ease-spring hover:border-primary/50 hover:shadow-lifted"
        >
          <ShieldAlert className="size-5 text-danger" aria-hidden />
          <h2 className="pt-3 font-display text-base font-semibold">Takedowns & legal</h2>
          <p className="pt-1.5 text-sm leading-relaxed text-foreground-muted">
            DMCA notices, record-keeping questions and removal requests. See the DMCA page for what a
            valid notice contains — complete notices are actioned fastest.
          </p>
        </a>

        <a
          href="mailto:hello@example.com"
          className="panel group rounded-card p-6 transition-all duration-300 ease-spring hover:border-primary/50 hover:shadow-lifted"
        >
          <Mail className="size-5 text-primary" aria-hidden />
          <h2 className="pt-3 font-display text-base font-semibold">Everything else</h2>
          <p className="pt-1.5 text-sm leading-relaxed text-foreground-muted">
            Feedback, a source we should be indexing, an indexing error, or business. We read
            everything, even if we do not answer everything.
          </p>
        </a>
      </div>

      <p className="text-xs leading-relaxed text-foreground-subtle">
        Mailboxes above are placeholders pending the operator’s domain email setup — wire them up
        before launch (see the note in the page source).
      </p>
    </div>
  );
}
