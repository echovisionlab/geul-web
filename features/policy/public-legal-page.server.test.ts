import { describe, expect, it, vi } from 'vitest';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableHrefBlock, siteVariableHrefCases } from '@/test/site-variable-link';
import { siteVariableContext } from '@/lib/site-variables';

const mocks = vi.hoisted(() => ({ policy: vi.fn(), site: vi.fn(), logFailure: vi.fn() }));
vi.mock('@/lib/logging/logger', () => ({ logServerFailure: mocks.logFailure }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/queries/metadata', () => ({ getSiteMetadataDocument: mocks.site }));
vi.mock('@/lib/queries/legal-public.server', () => ({
  getPublicPrivacyPage: mocks.policy,
  getPublicTermsPage: mocks.policy,
}));

import { getPublicLegalPagePresentation } from './public-legal-page.server';

describe('legal metadata', () => {
  it('logs a policy failure before using the existing metadata fallback', async () => {
    const error = new Error('policy service unavailable');
    mocks.site.mockResolvedValue({ siteTitle: 'Site' });
    mocks.policy.mockRejectedValue(error);
    expect((await getPublicLegalPagePresentation('terms', 'en')).snapshot).toBeNull();
    expect(mocks.logFailure).toHaveBeenCalledWith('public-legal-page', 'getPolicy terms', error);
  });
  it.each(siteVariableHrefCases)(
    'extracts labels without emitting or expanding hrefs: $name',
    async ({ source, settings }) => {
      mocks.site.mockResolvedValue({
        siteTitle: 'rawsector',
        siteVariables: siteVariableContext({ ...siteVariableManifest.settings, ...settings }),
      });
      mocks.policy.mockResolvedValue({ data: { active: { content: [siteVariableHrefBlock(source)] } } });
      expect((await getPublicLegalPagePresentation('privacy', 'en')).description).toBe('Contact');
    },
  );
});
