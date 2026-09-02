import { headers } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Get the base URL dynamically from request headers.
 * Falls back to canonical URL if host doesn't match HOST.
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || '';

  const isAllowed = host === env.HOST || host.startsWith(`${env.HOST}:`);

  if (!isAllowed) {
    return getCanonicalUrl();
  }

  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

/**
 * Get the canonical URL from environment.
 * Use this for static generation or when request context is not available.
 */
export function getCanonicalUrl(): string {
  return `https://${env.HOST}`;
}
