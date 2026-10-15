# Velvet

A fast, dark, adult video index. Velvet crawls a set of partner sites, keeps their
metadata in a local SQLite file, and shows it as one clean, searchable catalogue.

**Nothing is downloaded, transcoded or re-hosted.** Every card links back to the page it came from,
and playback happens on the publisher's own infrastructure — either their CDN's direct file or their
own embedded player, framed as-is.

## What's in it

- **Home catalogue** — server-rendered first page straight from SQLite (real content before any JS),
  then infinite scroll from our own API. No third-party API sits in the request path.
- **Search** across titles and tags, held in the URL so results stay shareable.
- **Source rail** — one row per indexed site, each opening just that site's videos, with live counts.
- **Three player modes**, decided by what the sync actually found on the source page:
  `video` (a direct CDN file played by the native player), `iframe` (the publisher's own player) and
  `link` (nothing embeddable was published — we hand the visitor off rather than pretend).
- **Accounts** — email + password, self-hosted. Signing in unlocks commenting.
- **Comments** per video, with the author or an operator able to delete one.
- **View counts** deduped per viewer per video per day, so a reload isn't a vote.
- **Admin console** at `/admin`: stats, sync + backfill controls, per-source park/resume,
  runtime settings, moderation, accounts and traffic.
- **Collapsible sidebar**, remembered per browser.
- **Poster-shaped cards** — each source's posters keep their own aspect ratio (see below).
- **Sorting** by newest, most viewed and oldest; newest means newest *published*.
- **Three themes** — **Noir** (near-black blue, the default), **Daylight** and **Glass** — as pure
  CSS variables, switched by one `data-theme` attribute with no flash on load.
- **Adult-content labelling**: the RTA meta label and `<meta name="rating" content="adult">` are set
  site-wide so parental filters classify the site correctly.
- Local, zero-dependency storage: SQLite through Node's built-in `node:sqlite` — no native addon
  build step, no database service to run.

Stack: Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · Radix primitives · Framer
Motion.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # optional for local dev — every var has a default
npm run dev                  # http://localhost:3000
```

With an empty database the home page tells you to run a sync. Do that once and the catalogue appears:

```bash
curl "http://localhost:3000/api/cron/sync?secret=dev-cron-key&pages=60&maxFetches=900"
```

## Building the catalogue

The index is populated by **the sync**, not by a seed file. `GET /api/cron/sync` walks listing pages
per source, parses each card, fetches the video's own page to find its player, and upserts the result.
Videos are de-duplicated by their canonical page URL, so every run is safe to repeat.

| Query param | Default | Meaning |
| --- | --- | --- |
| `secret` | — | Must match `CRON_SECRET` (or the `x-cron-secret` header). |
| `pages` | `2` | Listing pages walked **per source**. Deep values (60–400) build the catalogue. |
| `maxFetches` | `30` | Post-page fetches allowed **per source**, so one dense listing can't starve the others. |
| `delay` | `350` | Milliseconds between requests to a source. Raise it for long backfills. |
| `sources` | all enabled | Comma-separated source ids to restrict the run to. |

A routine refresh is the default two pages and takes about a minute. A first-time backfill asks for
depth instead:

```bash
# ~60 pages per source, ~1200 videos, a few minutes
curl "http://localhost:3000/api/cron/sync?secret=$CRON_SECRET&pages=60&maxFetches=900&delay=350"
```

An in-process scheduler re-runs a light sync every `AUTO_SYNC_INTERVAL_MINUTES` (default 120) so new
uploads appear on their own. Set it to `0` to disable.

### Sources

Sources live in `src/lib/tube/scraper/sources.ts` — one adapter each, exposing a listing URL, a
listing parser and an enrich step. The registry in the `sources` table mirrors them on every sync
(so renaming an adapter relabels existing rows) and carries an `enabled` flag: a parked source is
skipped entirely rather than burning a run's request budget.

Two platform parsers cover most of them, because the sites share engines:

- **`makeDesiHubPlatform`** — a Next.js grid of `/post/<slug>` cards whose posts carry a
  schema.org `VideoObject` with a `video.downloaddirect.xyz` mp4, a player frame, a poster and an
  original `uploadDate`.
- **`makeCdnPostPlatform`** — a Next.js `/videos/<slug>` catalogue whose posts carry a `VideoObject`
  with a direct mp4 on the site's own CDN (`cdn.<host>/…/video.mp4`) plus a real `datePublished`.
  No iframe and no signed token, so these play in a plain `<video>`.

| Source | Status |
| --- | --- |
| **Desi Hub** (`desihub.sh`) | Active · `desiHub` platform · portrait posters (3:4) |
| **Desi Babe** (`desibabe.co`) | Active · `desiHub` platform · portrait posters (~0.61) |
| **Video Celebs** (`videocelebs.net`) | Active · publisher iframe · **rate-limited**: ~25% of post pages carry the player at 300 ms pacing, ~90% at 2.5 s, so it declares its own pace and converts more rows on each pass |
| **Aditi Mistry** (`aditimistry.xyz`) | Active · `cdnPost` platform · 16:9 |
| **Lucky Rajor** (`luckyrajor.net`) | Active · `cdnPost` platform · paginates via `/page/N`, not `?page=N` |
| **Poonam Pandey** (`poonampandey.cc`) | Registered, but the origin is down (Cloudflare 522 on every path) — it indexes nothing until the origin returns |
| **AZ Nude** (`aznude.com`) | Registered, but its listing yields no title and no playable embed, so nothing is stored |
| **ENF CMNF** (`enf-cmnf.cc`), **The Desi Dude** (`thedesidude.com`) | Registered but publish nothing scrapeable (403 / a directory that only links out) |

Requested but unusable: `desihub.tv` (redirects to `desihub.sh`, already covered), and
`ytboob.com` / `nudedeleted.com` (both domains no longer resolve).

Adding a source means writing one adapter; no other code changes are needed for it to appear in the
rail, the filters and the sync.

---

## Architecture

```
src/
├─ app/
│  ├─ layout.tsx              root shell, fonts, theme script, adult labelling
│  ├─ page.tsx                home — brand band + newest catalogue
│  ├─ videos/                 the feed, its search/source/sort filters, and the watch page
│  └─ api/
│     ├─ tube/videos/         feed + facet counts (JSON, no-store)
│     ├─ tube/sources/        the source rail's data
│     ├─ tube/track/          anonymous visit counting
│     └─ cron/sync/           the sync + backfill entry point
├─ components/
│  ├─ layout/                 navbar, sidebar, mobile nav, theme switcher, search box
│  ├─ tube/                   card, grid, feed (infinite scroll), player, thumbnail
│  ├─ providers/              theme context + no-flash theme script
│  └─ ui/                     shadcn-style primitives on Radix
└─ lib/
   ├─ tube/
   │  ├─ db.ts                SQLite schema + every query (list, facets, upserts, runs, visits)
   │  ├─ html.ts              dependency-free fetch + regex parsing helpers
   │  └─ scraper/
   │     ├─ sources.ts        one adapter per site
   │     └─ index.ts          sync orchestrator + in-process scheduler
   ├─ hooks/                  debounce, in-view, infinite pagination, source rail
   ├─ cache/                  SWR cache + memory / Upstash / Vercel KV drivers
   └─ theme.ts routes.ts format.ts utils.ts env.ts
```

**Request path.** `/videos` (and the home page) read their first page from SQLite during the server
render, then hand `{ items, total, hasMore }` to `TubeFeed`, which pages through `/api/tube/videos`.
Rows are de-duplicated by id on append, because a sync running between two page requests can shift
rows between pages.

**The database** is `data/tube.db` plus its WAL sidecars (git-ignored). Tables: `videos`, `sources`,
`sync_runs`, `visits`, `settings`. `sync_runs` records every run with per-source added/updated/error
counts, so a failing source is visible instead of silent.

### Poster shapes

Sources publish stills in wildly different shapes: Desi Hub's are portrait (~3:4 — measurably
760×1352, 940×1477, 3072×4096) while Video Celebs' listing posters are 4:3. A fixed 16:9 frame
crops the portrait catalogue to ribbons, so each adapter declares a `thumbnailAspect`, it travels to
the `sources` table with the source, and every card is shaped to match. Because heights then differ,
the grid is CSS masonry rather than a row-aligned grid — the ordering reads down each column.

### Ordering

`newest` sorts by `COALESCE(published_at, scraped_at)`. Using `scraped_at` alone would be wrong the
moment a backfill runs: it inserts years of back catalogue in one burst, and the whole archive would
file ahead of what actually came out this week.

### Dates

A backfill inserts years of catalogue at once, so storing scrape time as the date would file the
whole archive under "today". Every adapter that can, reads the publisher's own date: `uploadDate` /
`datePublished` from the post's `VideoObject` — which is why Desi Babe's and Aditi Mistry's rows all
carry real dates and sort into their true chronology. Sources that publish no date (Video Celebs)
fall back to when we found them, and the card says so by showing a relative time from that.

### Pinning

The Content table in `/admin` has a Pin toggle per row. Pinned videos are carried in a **Pinned**
shelf at the top of the home page, ordered by when they were pinned rather than by date — pinning one
video shouldn't reshuffle the shelf. The home page's feed *excludes* pinned rows, so a pinned video
appears exactly once on the screen instead of in both the shelf and the feed right beneath it. The
shelf carries the first `HOME_PIN_LIMIT` (8) pins; pinned rows also float to the top of the admin
table so they are easy to find and unpin.

### Duplicate finder

`/admin` can scan the whole catalogue for the same video indexed more than once. Two signals:
an **identical embed URL** (two rows pointing at the exact same file — a duplicate with no judgement
call) and an **identical normalised title** (a lead: the same scene republished under a slightly
different name). The scan only reads and shows which row would survive each group; a second,
deliberate press deletes the rest. The survivor is the copy that plays, then has a poster, then has a
real date, then has the history. Comments on removed copies are moved to the survivor first, so
de-duplicating consolidates a video instead of discarding what people wrote about it.

### Accounts, comments and views

Everything is local. Passwords are hashed with `scrypt` (Node's standard library) and sessions are
rows in the same SQLite file, so a sign-out or a password change genuinely ends a session instead of
waiting out a token. **The first account created becomes the admin**; the `/admin` console itself is
gated by a separate `ADMIN_PASSWORD`, because membership must never be a route to operating the site.

Mutations are refused cross-origin and every admin endpoint re-checks the admin cookie server side —
gating the page alone would be a client-side illusion. Comments are capped at 1200 characters, and
comment counts are maintained in the same transaction as the row they describe.

### Sync rules worth knowing

- **Nothing unusable is stored.** An entry that ends up with no title *and* no embed is skipped — a
  blank "Untitled" card is worse than an empty page.
- **Per-source request budgets.** A shared budget lets the first adapter in the list consume every
  fetch and leave the rest with no playable embeds.
- **Retry once on failure.** Sources behind a cheap rate limiter answer a burst with a connection
  reset even though the same URL works seconds later; during a deep backfill that silently costs one
  embed in ten.
- **`no-embed` rows are retried** on later runs, so a video that was link-only yesterday can gain a
  player today.

### Compliance

An index like this has obligations worth stating plainly:

- **Attribution.** Every card shows the source site and links to the original page; the watch page
  shows the source and the canonical URL. Nothing is presented as ours.
- **No re-hosting.** We store metadata (title, description, poster URL, embed URL) and a local view
  counter. Media is never fetched, copied, proxied or cached, and posters are loaded hot from the
  source CDN.
- **Adult labelling.** RTA + `rating=adult` are set site-wide.
- **Take-downs.** A production deployment needs a DMCA/contact page and a way to remove a source or
  a single row (`setSourceEnabled` parks a source; `deleteVideo` removes a row). Neither is wired to
  the UI yet — if this is going public, that is the next thing to build.

## Configuration

Every variable has a default (see `.env.example`), so local development needs no `.env.local`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_NAME` | `Velvet` | Brand name in the nav, metadata and titles. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Absolute URLs for metadata / og tags. |
| `CRON_SECRET` | `dev-cron-key` | **Change before deploying.** Protects `/api/cron/sync`. |
| `ADMIN_PASSWORD` | `admin123` | **Change before deploying.** Gates the `/admin` console. |
| `AUTO_SYNC_INTERVAL_MINUTES` | `120` | In-process auto-sync cadence. `0` disables. |
| `CACHE_DRIVER` | `memory` | `memory` \| `upstash` \| `vercel-kv` for the optional YouTube surfaces. |
| `YOUTUBE_API_KEY` | — | Only needed by the legacy YouTube routes (`/watch`, `/search`, …), which are unlinked. |

### Legacy YouTube surfaces

The project began as a YouTube client and those routes still exist, unlinked from every nav:
`/watch`, `/search`, `/category/[slug]`, `/channel/[id]`, `/playlist/[id]`, `/library`. They render a
setup notice without `YOUTUBE_API_KEY`, and the shared `src/lib/youtube/*` library, cache and quota
governor still serve them. They are safe to delete once nothing links to them.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit`, strict mode |

## Deploying

Any Node host works (`npm run build && npm start`). Two notes for a real deployment:

1. **The database is a file.** `data/tube.db` must live on a persistent volume; on an ephemeral
   filesystem the catalogue is rebuilt by a sync on every cold start.
2. **Run the sync somewhere.** Either keep a long-lived process (the in-process scheduler does it),
   or schedule the cron endpoint from the platform — that is what `CRON_SECRET` is for.

## Licence

Provided as an example implementation. All video content belongs to the sites that publish it.
