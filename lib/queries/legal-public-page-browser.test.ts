import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicPrivacyClient, createPublicPrivacyClientWithLocale } from '@/lib/api/browser/public-privacy';
import { createPublicTermsClient, createPublicTermsClientWithLocale } from '@/lib/api/browser/public-terms';
import { getActivePrivacy, getPrivacyPageData, getScheduledPrivacy } from './privacy-browser';
import { getActiveTerms, getScheduledTerms, getTermsPageData } from './terms-browser';

const { localizedBlocks } = vi.hoisted(() => ({
  localizedBlocks: [{ id: 'localized-block', kind: 'paragraph' }] as const,
}));

vi.mock('@/lib/api/browser/public-privacy', () => ({
  createPublicPrivacyClient: vi.fn(),
  createPublicPrivacyClientWithLocale: vi.fn(),
}));
vi.mock('@/lib/api/browser/public-terms', () => ({
  createPublicTermsClient: vi.fn(),
  createPublicTermsClientWithLocale: vi.fn(),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn() }),
  serializeClientLogError: (error: unknown) => error,
}));

vi.mock('@/features/editor/contract/localized-rich-text', () => ({
  materializeLocalizedRichTextTree: vi.fn(() => localizedBlocks),
}));

const privacyGet = vi.fn();
const termsGet = vi.fn();
const privacyList = vi.fn();
const termsList = vi.fn();
const effectiveFrom = timestampFromDate(new Date('2026-09-01T00:00:00.000Z'));
const localizationInfo = {
  requestedLocale: 'ko',
  displayedLocale: 'ko',
  sourceLocale: 'en',
  isFallback: false,
  isOriginal: false,
  machineGenerated: true,
  fallbackReason: 0,
  availableLocales: ['en', 'ko'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createPublicPrivacyClient).mockReturnValue({ get: privacyGet, list: privacyList } as unknown as ReturnType<
    typeof createPublicPrivacyClient
  >);
  vi.mocked(createPublicPrivacyClientWithLocale).mockReturnValue({
    get: privacyGet,
    list: privacyList,
  } as unknown as ReturnType<typeof createPublicPrivacyClientWithLocale>);
  vi.mocked(createPublicTermsClient).mockReturnValue({ get: termsGet, list: termsList } as unknown as ReturnType<
    typeof createPublicTermsClient
  >);
  vi.mocked(createPublicTermsClientWithLocale).mockReturnValue({
    get: termsGet,
    list: termsList,
  } as unknown as ReturnType<typeof createPublicTermsClientWithLocale>);
});

describe('public legal page browser queries', () => {
  it('loads and maps both the active and scheduled privacy policy with one localized RPC', async () => {
    privacyGet.mockResolvedValue({
      privacy: {
        id: 'privacy-active',
        version: 4,
        title: 'Privacy Policy',
        document: { locale: 'ko' },
        localizationInfo,
        effectiveFrom,
      },
      scheduled: {
        id: 'privacy-scheduled',
        version: 5,
        title: 'Upcoming Privacy Policy',
        document: { locale: 'ko' },
        localizationInfo,
        effectiveFrom,
      },
    });

    await expect(getPrivacyPageData('ko')).resolves.toEqual({
      active: {
        id: 'privacy-active',
        version: 4,
        title: 'Privacy Policy',
        content: localizedBlocks,
        localizationInfo: { ...localizationInfo },
        status: 'active',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        createdAt: null,
      },
      scheduled: {
        id: 'privacy-scheduled',
        version: 5,
        title: 'Upcoming Privacy Policy',
        localizationInfo: { ...localizationInfo },
        status: 'scheduled',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    expect(createPublicPrivacyClientWithLocale).toHaveBeenCalledOnce();
    expect(createPublicPrivacyClientWithLocale).toHaveBeenCalledWith('ko');
    expect(createPublicPrivacyClient).not.toHaveBeenCalled();
    expect(privacyGet).toHaveBeenCalledOnce();
    expect(privacyGet).toHaveBeenCalledWith({});
  });

  it('loads both terms values from one default-locale RPC', async () => {
    termsGet.mockResolvedValue({
      terms: { id: 'terms-active', version: 2, title: 'Terms', document: null },
      scheduled: { id: 'terms-scheduled', version: 3, title: 'Upcoming Terms', effectiveFrom },
    });

    await expect(getTermsPageData()).resolves.toEqual({
      active: {
        id: 'terms-active',
        version: 2,
        title: 'Terms',
        content: null,
        localizationInfo: null,
        status: 'active',
        effectiveFrom: null,
        createdAt: null,
      },
      scheduled: {
        id: 'terms-scheduled',
        version: 3,
        title: 'Upcoming Terms',
        localizationInfo: null,
        status: 'scheduled',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    expect(createPublicTermsClient).toHaveBeenCalledOnce();
    expect(createPublicTermsClientWithLocale).not.toHaveBeenCalled();
    expect(termsGet).toHaveBeenCalledOnce();
    expect(termsGet).toHaveBeenCalledWith({});
  });

  it('returns an empty pair for NotFound from either public service', async () => {
    privacyGet.mockRejectedValueOnce(new ConnectError('missing privacy', Code.NotFound));
    termsGet.mockRejectedValueOnce(new ConnectError('missing terms', Code.NotFound));

    await expect(getPrivacyPageData()).resolves.toEqual({ active: null, scheduled: null });
    await expect(getTermsPageData()).resolves.toEqual({ active: null, scheduled: null });
    expect(privacyGet).toHaveBeenCalledOnce();
    expect(termsGet).toHaveBeenCalledOnce();
  });

  it('propagates transient RPC errors', async () => {
    const error = new ConnectError('temporarily unavailable', Code.Unavailable);
    privacyGet.mockRejectedValueOnce(error);
    termsGet.mockRejectedValueOnce(error);

    await expect(getPrivacyPageData('fr')).rejects.toBe(error);
    await expect(getTermsPageData('fr')).rejects.toBe(error);
    expect(createPublicPrivacyClientWithLocale).toHaveBeenCalledWith('fr');
    expect(createPublicTermsClientWithLocale).toHaveBeenCalledWith('fr');
    expect(privacyGet).toHaveBeenCalledOnce();
    expect(termsGet).toHaveBeenCalledOnce();
  });

  it('keeps the active and scheduled compatibility wrappers mapped from their combined getters', async () => {
    privacyGet.mockResolvedValue({
      privacy: { id: 'privacy-current', version: 1, title: 'Privacy', document: null },
      scheduled: { id: 'privacy-next', version: 2, title: 'Next Privacy' },
    });
    termsGet.mockResolvedValue({
      terms: { id: 'terms-current', version: 1, title: 'Terms', document: null },
      scheduled: { id: 'terms-next', version: 2, title: 'Next Terms' },
    });

    await expect(getActivePrivacy('ja')).resolves.toMatchObject({ id: 'privacy-current', status: 'active' });
    await expect(getScheduledPrivacy('ja')).resolves.toMatchObject({ id: 'privacy-next', status: 'scheduled' });
    await expect(getActiveTerms('ja')).resolves.toMatchObject({ id: 'terms-current', status: 'active' });
    await expect(getScheduledTerms('ja')).resolves.toMatchObject({ id: 'terms-next', status: 'scheduled' });

    expect(privacyGet).toHaveBeenCalledTimes(2);
    expect(termsGet).toHaveBeenCalledTimes(2);
    expect(privacyGet).toHaveBeenNthCalledWith(1, {});
    expect(privacyGet).toHaveBeenNthCalledWith(2, {});
    expect(termsGet).toHaveBeenNthCalledWith(1, {});
    expect(termsGet).toHaveBeenNthCalledWith(2, {});
    expect(createPublicPrivacyClientWithLocale).toHaveBeenCalledTimes(2);
    expect(createPublicTermsClientWithLocale).toHaveBeenCalledTimes(2);
  });
});
