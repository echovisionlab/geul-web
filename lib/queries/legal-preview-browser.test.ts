import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicPrivacyClient,
  createPublicPrivacyClientWithLocale,
  createPublicTermsClient,
  createPublicTermsClientWithLocale,
} from '@/lib/api/browser-client';
import { getArchivedPrivacy, getScheduledPrivacyPreview } from './privacy-browser';
import { getArchivedTerms, getScheduledTermsPreview } from './terms-browser';

const { localizedBlocks } = vi.hoisted(() => ({
  localizedBlocks: [{ id: 'block-1', kind: 'paragraph' }] as const,
}));

vi.mock('@/lib/api/browser-client', () => ({
  createPublicPrivacyClient: vi.fn(),
  createPublicPrivacyClientWithLocale: vi.fn(),
  createPublicTermsClient: vi.fn(),
  createPublicTermsClientWithLocale: vi.fn(),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    error: vi.fn(),
  }),
  serializeClientLogError: (error: unknown) => error,
}));

vi.mock('@/features/editor/contract/localized-rich-text', () => ({
  materializeLocalizedRichTextTree: vi.fn(() => localizedBlocks),
}));

const privacyGet = vi.fn();
const termsGet = vi.fn();
const privacyList = vi.fn();
const termsList = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createPublicPrivacyClient).mockReturnValue({
    get: privacyGet,
    list: privacyList,
  } as unknown as ReturnType<typeof createPublicPrivacyClient>);
  vi.mocked(createPublicPrivacyClientWithLocale).mockReturnValue({
    get: privacyGet,
    list: privacyList,
  } as unknown as ReturnType<typeof createPublicPrivacyClientWithLocale>);
  vi.mocked(createPublicTermsClient).mockReturnValue({
    get: termsGet,
    list: termsList,
  } as unknown as ReturnType<typeof createPublicTermsClient>);
  vi.mocked(createPublicTermsClientWithLocale).mockReturnValue({
    get: termsGet,
    list: termsList,
  } as unknown as ReturnType<typeof createPublicTermsClientWithLocale>);
});

describe('legal scheduled preview browser queries', () => {
  it('forwards the exact privacy version ID with its ShareLink token', async () => {
    privacyGet.mockResolvedValue({
      scheduled: {
        id: 'privacy-version-2',
        version: 2,
        title: 'Privacy Policy',
        document: { locale: 'ko' },
      },
    });

    await expect(getScheduledPrivacyPreview('privacy-version-2', 'privacy-token', 'ko')).resolves.toMatchObject({
      id: 'privacy-version-2',
      content: localizedBlocks,
    });

    expect(createPublicPrivacyClientWithLocale).toHaveBeenCalledWith('ko');
    expect(privacyGet).toHaveBeenCalledWith({
      id: 'privacy-version-2',
      shareToken: 'privacy-token',
    });
  });

  it('forwards the exact terms version ID with its ShareLink token', async () => {
    termsGet.mockResolvedValue({
      scheduled: {
        id: 'terms-version-2',
        version: 2,
        title: 'Terms of Service',
        document: { locale: 'en' },
      },
    });

    await expect(getScheduledTermsPreview('terms-version-2', 'terms-token')).resolves.toMatchObject({
      id: 'terms-version-2',
      content: localizedBlocks,
    });

    expect(createPublicTermsClient).toHaveBeenCalledOnce();
    expect(termsGet).toHaveBeenCalledWith({
      id: 'terms-version-2',
      shareToken: 'terms-token',
    });
  });
});

describe('legal history browser queries', () => {
  it('reports the exact privacy history version as active when it is current', async () => {
    privacyGet
      .mockResolvedValueOnce({
        privacy: {
          id: 'privacy-version-2',
          version: 2,
          title: 'Privacy Policy',
          document: { locale: 'en' },
        },
      })
      .mockResolvedValueOnce({ privacy: { id: 'privacy-version-2' } });

    await expect(getArchivedPrivacy('privacy-version-2')).resolves.toMatchObject({
      id: 'privacy-version-2',
      status: 'active',
    });
    expect(privacyGet).toHaveBeenNthCalledWith(1, { id: 'privacy-version-2' });
    expect(privacyGet).toHaveBeenNthCalledWith(2, {});
  });

  it('reports a non-current terms history version as archived', async () => {
    termsGet
      .mockResolvedValueOnce({
        terms: {
          id: 'terms-version-1',
          version: 1,
          title: 'Terms of Service',
          document: { locale: 'en' },
        },
      })
      .mockResolvedValueOnce({ terms: { id: 'terms-version-2' } });
    termsList.mockResolvedValue({
      items: [
        {
          id: 'terms-version-1',
          effectiveUntil: { seconds: 1_786_147_199n, nanos: 0 },
        },
      ],
    });

    await expect(getArchivedTerms('terms-version-1')).resolves.toMatchObject({
      id: 'terms-version-1',
      status: 'archived',
      effectiveUntil: new Date('2026-08-07T23:59:59.000Z'),
    });
    expect(termsGet).toHaveBeenNthCalledWith(1, { id: 'terms-version-1' });
    expect(termsGet).toHaveBeenNthCalledWith(2, {});
    expect(termsList).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });
});
