import { describe, expect, it } from 'vitest';
import { buildLoginRedirectHref } from './login-page';

describe('buildLoginRedirectHref', () => {
  it('encodes the redirect path exactly once', () => {
    expect(buildLoginRedirectHref('/admin/pages/123?lang=ko&tab=summary')).toBe(
      '/login?redirect=%2Fadmin%2Fpages%2F123%3Flang%3Dko%26tab%3Dsummary',
    );
  });
});
