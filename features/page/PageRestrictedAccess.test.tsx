import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { PageRestrictedAccess } from './PageRestrictedAccess';

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));

describe('PageRestrictedAccess', () => {
  it('offers login with the exact return path without page-specific content', async () => {
    const content = await PageRestrictedAccess({ reason: 'authentication-required', returnTo: '/members?lang=ko' });
    const html = renderToStaticMarkup(<MantineProvider>{content}</MantineProvider>);
    expect(html).toContain('loginRequiredTitle');
    expect(html).toContain('loginRequiredDescription');
    expect(html).toContain('/login?redirect=%2Fmembers%3Flang%3Dko');
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('img');
  });

  it('explains unmet conditions without claiming the account is logged out', async () => {
    const content = await PageRestrictedAccess({ reason: 'conditions-not-met', returnTo: '/members' });
    const html = renderToStaticMarkup(<MantineProvider>{content}</MantineProvider>);
    expect(html).toContain('restrictedTitle');
    expect(html).toContain('restrictedDescription');
    expect(html).not.toContain('loginRequiredTitle');
    expect(html).not.toContain('href=');
  });
});
