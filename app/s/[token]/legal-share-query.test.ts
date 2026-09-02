import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicPrivacyClientWithAuth, createPublicTermsClientWithAuth } from '@/lib/api/server-client';
import { getLegalShareDocument } from './legal-share-query';

const { localizedBlocks } = vi.hoisted(() => ({
  localizedBlocks: [{ id: 'block-1', kind: 'paragraph' }] as const,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server-client', () => ({
  createPublicPrivacyClientWithAuth: vi.fn(),
  createPublicTermsClientWithAuth: vi.fn(),
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
  vi.mocked(createPublicPrivacyClientWithAuth).mockResolvedValue({
    get: privacyGet,
    list: privacyList,
  } as unknown as Awaited<ReturnType<typeof createPublicPrivacyClientWithAuth>>);
  vi.mocked(createPublicTermsClientWithAuth).mockResolvedValue({
    get: termsGet,
    list: termsList,
  } as unknown as Awaited<ReturnType<typeof createPublicTermsClientWithAuth>>);
});

describe('getLegalShareDocument', () => {
  it('returns an exact active or archived privacy target after password proof', async () => {
    privacyGet.mockResolvedValue({
      privacy: {
        id: 'privacy-version-2',
        version: 2,
        title: 'Privacy history',
        document: { locale: 'ko' },
        effectiveFrom: { seconds: 1_767_225_600n, nanos: 0 },
      },
    });
    privacyList.mockResolvedValue({
      items: [
        {
          id: 'privacy-version-2',
          effectiveUntil: { seconds: 1_786_147_199n, nanos: 0 },
        },
      ],
    });

    await expect(
      getLegalShareDocument('privacy', 'privacy-version-2', 'privacy-token', 'ko', 'secret'),
    ).resolves.toMatchObject({
      entityType: 'privacy',
      version: 2,
      content: localizedBlocks,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveUntil: '2026-08-07T23:59:59.000Z',
    });
    expect(privacyGet).toHaveBeenCalledWith({
      id: 'privacy-version-2',
      shareToken: 'privacy-token',
      sharePassword: 'secret',
    });
    expect(privacyList).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });

  it('continues to return an exact scheduled terms preview', async () => {
    termsGet.mockResolvedValue({
      scheduled: {
        id: 'terms-version-3',
        version: 3,
        title: 'Upcoming terms',
        document: { locale: 'en' },
      },
    });

    await expect(getLegalShareDocument('terms', 'terms-version-3', 'terms-token', 'en')).resolves.toMatchObject({
      entityType: 'terms',
      version: 3,
      content: localizedBlocks,
    });
    expect(termsList).not.toHaveBeenCalled();
  });
});
