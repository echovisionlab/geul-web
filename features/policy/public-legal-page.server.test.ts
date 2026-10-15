import { describe, expect, it, vi } from 'vitest';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableHrefBlock, siteVariableHrefCases } from '@/test/site-variable-link';
import { siteVariableContext } from '@/lib/site-variables';

const mocks = vi.hoisted(() => ({ policy: vi.fn(), site: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/queries/metadata', () => ({ getSiteMetadataDocument: mocks.site }));
vi.mock('@/lib/queries/legal-public.server', () => ({
  getPublicPrivacyPage: mocks.policy,
  getPublicTermsPage: mocks.policy,
}));

import { getPublicLegalPagePresentation } from './public-legal-page.server';

describe('legal metadata', () => {
  it.each(siteVariableHrefCases)(
    'extracts labels without emitting or expanding hrefs: $name',
    async ({ source, settings }) => {
      mocks.site.mockResolvedValue({
        siteTitle: 'Rawsector',
        siteVariables: siteVariableContext({ ...siteVariableManifest.settings, ...settings }),
      });
      mocks.policy.mockResolvedValue({ data: { active: { content: [siteVariableHrefBlock(source)] } } });
      expect((await getPublicLegalPagePresentation('privacy', 'en')).description).toBe('Contact');
    },
  );
});
