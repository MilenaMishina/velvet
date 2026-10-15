import { serveEnvelope } from '@/lib/api/envelope';
import { serverEnv } from '@/lib/env';
import { fallbackCategoryDirectory, getCategoryDirectory } from '@/lib/youtube/service';

/**
 * GET /api/youtube/categories
 *
 * 1 unit, cached for a day. If it fails we still answer 200 with the curated
 * fallback list so the browse rail never vanishes.
 */
export async function GET() {
  return serveEnvelope(() => getCategoryDirectory(), {
    ttlSeconds: serverEnv.cache.ttl.static,
    fallback: fallbackCategoryDirectory,
  });
}
