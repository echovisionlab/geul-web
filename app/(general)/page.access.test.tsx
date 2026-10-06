import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage, { generateMetadata } from './page';
import { PageRestrictedAccess } from '@/features/page/PageRestrictedAccess';

const mocks = vi.hoisted(() => ({ getPageAccessView: vi.fn(), getHomeMetadataDocument: vi.fn() }));
vi.mock('@/lib/queries/page', () => ({ getPageAccessView: mocks.getPageAccessView }));
vi.mock('@/lib/queries/metadata', () => ({ getHomeMetadataDocument: mocks.getHomeMetadataDocument }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: async () => 'ko' }));
vi.mock('@/features/print/PrintButton', () => ({ PrintButton: () => null }));

beforeEach(() => vi.clearAllMocks());

describe('restricted homepage', () => {
  it.each(['authentication-required', 'conditions-not-met'] as const)(
    'renders the %s decision before metadata or media is loaded',
    async (reason) => {
      mocks.getPageAccessView.mockResolvedValue({ reason });
      const props = { searchParams: Promise.resolve({ lang: 'ko' }) };
      const result = await HomePage(props);
      expect(result.type).toBe(PageRestrictedAccess);
      expect(result.props).toEqual({ reason, returnTo: '/' });
      expect(mocks.getHomeMetadataDocument).not.toHaveBeenCalled();
      const metadata = await generateMetadata(props);
      expect(metadata.robots).toMatchObject({ index: false });
      expect(mocks.getHomeMetadataDocument).not.toHaveBeenCalled();
    },
  );
});
