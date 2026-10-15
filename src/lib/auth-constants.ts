/**
 * Auth values both the server and the browser need.
 *
 * Kept out of `lib/auth.ts` on purpose: that module imports `node:crypto` and
 * `next/headers`, so importing it from a client component would drag the server
 * runtime into the browser bundle.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const SESSION_COOKIE_NAME = 'velvet_session';

/**
 * The signed-in user as the browser sees it.
 *
 * Structurally identical to the server's `TubeUser`; declared here so a client
 * component can name the type without importing the SQLite module.
 */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'admin';
  createdAt: string;
}
