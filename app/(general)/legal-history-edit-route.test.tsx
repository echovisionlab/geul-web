import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivacyHistoryDetailPage from './privacy/history/[id]/page';
import TermsHistoryDetailPage from './terms/history/[id]/page';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
  getPrivacyVersion: vi.fn(),
  getTermsVersion: vi.fn(),
  getAllSiteSettings: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('next/server', () => ({ connection: mocks.connection }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/policy/PrivacyEditor', () => ({ PrivacyEditor: () => null }));
vi.mock('@/features/policy/TermsEditor', () => ({ TermsEditor: () => null }));
vi.mock('@/features/metadata/ui/JsonLdScript', () => ({ JsonLdScript: () => null }));
vi.mock('@/lib/queries/metadata', () => ({ getSiteMetadataDocument: vi.fn() }));
vi.mock('@/lib/queries/privacy', () => ({ getPrivacyVersion: mocks.getPrivacyVersion }));
vi.mock('@/lib/queries/terms', () => ({ getTermsVersion: mocks.getTermsVersion }));
vi.mock('@/lib/queries/site-setting', () => ({ getAllSiteSettings: mocks.getAllSiteSettings }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('./privacy/history/[id]/PrivacyHistoryDetailClient', () => ({ PrivacyHistoryDetailClient: () => null }));
vi.mock('./terms/history/[id]/TermsHistoryDetailClient', () => ({ TermsHistoryDetailClient: () => null }));

const editSearchParams = Promise.resolve({ edit: 'true' });

describe('canonical Legal history edit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllSiteSettings.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({ user: { id: 'admin-1', nickname: 'Admin', role: 'admin' } });
  });

  it('returns 404 for an unauthorized Privacy edit request', async () => {
    mocks.getPrivacyVersion.mockRejectedValue(new ConnectError('denied', Code.PermissionDenied));

    await expect(
      PrivacyHistoryDetailPage({
        params: Promise.resolve({ id: 'privacy-1' }),
        searchParams: editSearchParams,
      }),
    ).rejects.toThrow('not-found');

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('returns 404 when the exact Privacy version does not exist', async () => {
    mocks.getPrivacyVersion.mockResolvedValue(null);

    await expect(
      PrivacyHistoryDetailPage({
        params: Promise.resolve({ id: 'missing-privacy' }),
        searchParams: editSearchParams,
      }),
    ).rejects.toThrow('not-found');

    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('returns 404 for an unauthorized Terms edit request', async () => {
    mocks.getTermsVersion.mockRejectedValue(new ConnectError('unauthenticated', Code.Unauthenticated));

    await expect(
      TermsHistoryDetailPage({
        params: Promise.resolve({ id: 'terms-1' }),
        searchParams: editSearchParams,
      }),
    ).rejects.toThrow('not-found');

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('returns 404 when the exact Terms version does not exist', async () => {
    mocks.getTermsVersion.mockResolvedValue(null);

    await expect(
      TermsHistoryDetailPage({
        params: Promise.resolve({ id: 'missing-terms' }),
        searchParams: editSearchParams,
      }),
    ).rejects.toThrow('not-found');

    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('mounts archived Terms history for an Author without loading admin settings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'author-1', nickname: 'Author', role: 'author' } });
    mocks.getTermsVersion.mockResolvedValue({
      id: 'terms-archived',
      title: 'Archived Terms',
      status: 'TERMS_STATUS_ARCHIVED',
      document: null,
    });

    const page = await TermsHistoryDetailPage({
      params: Promise.resolve({ id: 'terms-archived' }),
      searchParams: editSearchParams,
    });

    expect(page.props.initialTerms.title).toBe('Archived Terms');
    expect(page.props.canEdit).toBe(false);
    expect(mocks.getAllSiteSettings).not.toHaveBeenCalled();
  });

  it('mounts archived Privacy history for an Author without loading admin settings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'author-1', nickname: 'Author', role: 'author' } });
    mocks.getPrivacyVersion.mockResolvedValue({
      id: 'privacy-archived',
      title: 'Archived Privacy',
      status: 'PRIVACY_STATUS_ARCHIVED',
      document: null,
    });

    const page = await PrivacyHistoryDetailPage({
      params: Promise.resolve({ id: 'privacy-archived' }),
      searchParams: editSearchParams,
    });

    expect(page.props.initialPrivacy.title).toBe('Archived Privacy');
    expect(page.props.canEdit).toBe(false);
    expect(mocks.getAllSiteSettings).not.toHaveBeenCalled();
  });

  it.each([
    ['Terms', 'TERMS_STATUS_SCHEDULED', 'getTermsVersion', TermsHistoryDetailPage, 'terms-locked'],
    ['Privacy', 'PRIVACY_STATUS_ACTIVE', 'getPrivacyVersion', PrivacyHistoryDetailPage, 'privacy-locked'],
  ] as const)(
    'keeps non-archived %s history unavailable outside Admin edit routes',
    async (_name, status, query, Page, id) => {
      mocks[query].mockResolvedValue({ id, title: 'Locked policy', status, document: null });
      mocks.getSession.mockResolvedValue({ user: { id: 'author-1', nickname: 'Author', role: 'author' } });

      await expect(Page({ params: Promise.resolve({ id }), searchParams: editSearchParams })).rejects.toThrow(
        'not-found',
      );
    },
  );
});
