import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';

import { AdConfigProvider } from '@/components/ads/ad-config-provider';
import { AdPopunder, AdSocialBar } from '@/components/ads/ad-scripts';
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from '@/components/providers/providers';
import { ThemeScript } from '@/components/providers/theme-script';
import { adConfigFromSettings } from '@/lib/ads';
import { publicEnv } from '@/lib/env';
import { DEFAULT_THEME, themeDefinition } from '@/lib/theme';
import { adSettingValues } from '@/lib/tube/db';

/**
 * Variable fonts, self-hosted by `next/font` at build time — no runtime request to
 * Google, which keeps the CSP tight and avoids layout shift.
 */
const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const display = Sora({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: `${publicEnv.siteName} — premium adult video, curated`,
    template: `%s · ${publicEnv.siteName}`,
  },
  description:
    'Thousands of adult videos from the sites we index, streamed from each publisher’s own player. Fast, private, and free of the usual clutter.',
  applicationName: publicEnv.siteName,
  openGraph: {
    siteName: publicEnv.siteName,
    type: 'website',
    locale: 'en_US',
    description: 'Thousands of adult videos from the sites we index, streamed from each publisher’s own player.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  other: {
    // Self-labelling for adult content. This is the RTA (Restricted To Adults)
    // label, which parental-control and safe-search filters read — an adult site
    // that omits it gets miscategorised as general-audience content, which is a
    // real problem for a site aimed at an adult audience, not a legal formality.
    rating: 'RTA-5042-1996-1400-1577-RTA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: themeDefinition(DEFAULT_THEME).themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once here and handed down, so a request cannot render a slot decided by one
  // set of switches and a page script decided by another.
  const adConfig = adConfigFromSettings(adSettingValues());

  return (
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <head>
        <ThemeScript />
        {/* The popunder lives in the head, where its network expects it. */}
        <AdPopunder config={adConfig} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:shadow-lifted"
        >
          Skip to content
        </a>
        <AdConfigProvider value={adConfig}>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </AdConfigProvider>
        <AdSocialBar config={adConfig} />
      </body>
    </html>
  );
}
