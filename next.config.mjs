/**
 * Next.js configuration.
 *
 * The tube surfaces scrape-indexed videos from partner sites, so the CSP allows
 * any https: host for images, media and frames — thumbnails and embedded players
 * are loaded straight from the source CDNs (never re-hosted by us).
 */

const isDev = process.env.NODE_ENV !== 'production';

/** CSP tuned for scraped embeds (source CDNs) + the YouTube embed + ad iframes. */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // Source player bundles, ad networks and the YouTube IFrame API.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`,
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // Direct mp4/HLS from source CDNs (e.g. aznude) plus YouTube's player.
  "media-src 'self' blob: https:",
  "frame-src 'self' https:",
  "child-src 'self' https:",
  "connect-src 'self' https:",
  'upgrade-insecure-requests',
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Thumbnails come from source CDNs (we never copy them) plus Google's hosts
    // for the legacy YouTube surfaces.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
