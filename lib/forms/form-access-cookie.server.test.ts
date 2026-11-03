import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { ENCRYPTION_SECRET: 'test-encryption-secret-123' } }));

import { openFormAccessGrant, sealFormAccessGrant } from './form-access-cookie.server';

describe('Form access grant', () => {
  const now = Date.UTC(2026, 10, 3);
  const sealed = sealFormAccessGrant({ slug: 'survey', password: 'open-sesame', expiresAt: now + 1000 });

  it('opens only for its own Form before it expires', () => {
    expect(sealed).not.toContain('open-sesame');
    expect(openFormAccessGrant(sealed, 'survey', now)).toBe('open-sesame');
    expect(openFormAccessGrant(sealed, 'other-form', now)).toBeUndefined();
    expect(openFormAccessGrant(sealed, 'survey', now + 1000)).toBeUndefined();
  });

  it('rejects a tampered or foreign value', () => {
    const raw = Buffer.from(sealed, 'base64url');
    raw[raw.length - 1] ^= 1;
    expect(openFormAccessGrant(raw.toString('base64url'), 'survey', now)).toBeUndefined();
    expect(openFormAccessGrant('not-a-grant', 'survey', now)).toBeUndefined();
  });
});
