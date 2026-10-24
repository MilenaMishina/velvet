import { Flame, Globe2, Gauge, HeartHandshake, ShieldCheck, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { publicEnv } from '@/lib/env';
import { formatCompactNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import { listSourcesWithCounts, tubeStats } from '@/lib/tube/db';

export const metadata: Metadata = {
  title: 'About',
  description: `What ${publicEnv.siteName} is, and the rules it runs by.`,
};

/** The database changes on every sync — never prerender it at build time. */
export const dynamic = 'force-dynamic';

const PRINCIPLES = [
  {
    Icon: Zap,
    title: 'Fast by architecture',
    body: 'Pages render from our own catalogue before any JavaScript runs. Fonts are self-hosted, images load straight from source CDNs, and the feed paginates without a page reload.',
  },
  {
    Icon: HeartHandshake,
    title: 'Attribution, always',
    body: 'Every card names the site a scene came from and links to the original page. We never copy or re-host; playback happens on the publisher’s own player and CDN.',
  },
  {
    Icon: ShieldCheck,
    title: 'Private by default',
    body: 'No account needed to watch. No tracking pixels, no analytics scripts, no advertising cookies beyond the ad network’s own. The site couldn’t sell your data — it doesn’t collect any.',
  },
  {
    Icon: Gauge,
    title: 'Automated freshness',
    body: 'A scheduled sync walks every source we follow, adds what is new since the last run, and records every run. The catalogue updates itself, around the clock.',
  },
];

export default function AboutPage() {
  const stats = tubeStats();
  const sources = listSourcesWithCounts();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={
          <>
            <Flame className="size-3.5" aria-hidden />
            {publicEnv.siteName}
          </>
        }
        title="The index, done properly"
        description={`${formatCompactNumber(stats.publishedVideos)} scenes from ${sources.length} sites, and one rule above all: the people who make the content keep the credit, the traffic and the control.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((item) => (
          <div key={item.title} className="panel rounded-card p-6">
            <item.Icon className="size-5 text-primary" aria-hidden />
            <h2 className="pt-3 font-display text-base font-semibold tracking-[-0.01em]">{item.title}</h2>
            <p className="pt-1.5 text-sm leading-relaxed text-foreground-muted">{item.body}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Where the catalogue comes from</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground-muted">
          The sites below are crawled on a schedule. Each scene plays on its publisher&rsquo;s own
          player — we index the metadata, the poster and the path to the original page, nothing more.
        </p>
        <ul className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <li key={source.id}>
              <Link href={routes.tube.filtered({ source: source.id })} className="chip">
                <Globe2 className="size-3" aria-hidden />
                {source.name}
                <span className="tabular-nums text-2xs opacity-60">{source.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
