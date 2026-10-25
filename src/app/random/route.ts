import { redirect } from 'next/navigation';

import { randomVideoId } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * "Surprise me".
 *
 * A redirect rather than a client shuffle so the destination is a real URL the
 * visitor can share or go back to. `no-store` per visitor — otherwise the first
 * random pick would be cached and everyone would land on the same scene.
 */
export function GET() {
  const id = randomVideoId();
  redirect(id ? `/videos/${id}` : '/videos');
}
