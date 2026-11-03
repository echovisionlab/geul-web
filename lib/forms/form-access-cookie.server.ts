import 'server-only';

import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

const COOKIE_PREFIX = 'geul_form_access_';
const LIFETIME_SECONDS = 12 * 60 * 60;
const KEY_INFO = 'geul-form-access-cookie/v1';

interface FormAccessGrant {
  slug: string;
  password: string;
  expiresAt: number;
}

/** One cookie per Form; the name does not reveal the slug. */
function cookieName(slug: string) {
  return COOKIE_PREFIX + createHash('sha256').update(slug).digest('base64url').slice(0, 22);
}

function key() {
  return Buffer.from(hkdfSync('sha256', env.ENCRYPTION_SECRET, '', KEY_INFO, 32));
}

/** Seals a grant with AES-256-GCM so the cookie is unreadable and tamper-evident. */
export function sealFormAccessGrant(grant: FormAccessGrant): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(grant), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function openFormAccessGrant(sealed: string, slug: string, now = Date.now()): string | undefined {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const grant = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'),
    ) as Partial<FormAccessGrant>;
    return grant.slug === slug && typeof grant.password === 'string' && (grant.expiresAt ?? 0) > now
      ? grant.password
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remembers a verified Form password for this browser in an HttpOnly cookie that page scripts cannot
 * read. Server actions forward it to the API, which keeps verifying the password on every request.
 */
export async function rememberFormPassword(slug: string, password: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    cookieName(slug),
    sealFormAccessGrant({ slug, password, expiresAt: Date.now() + LIFETIME_SECONDS * 1000 }),
    { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: LIFETIME_SECONDS },
  );
}

export async function readFormPassword(slug: string): Promise<string | undefined> {
  const sealed = (await cookies()).get(cookieName(slug))?.value;
  return sealed ? openFormAccessGrant(sealed, slug) : undefined;
}

export async function forgetFormPassword(slug: string) {
  (await cookies()).delete(cookieName(slug));
}
