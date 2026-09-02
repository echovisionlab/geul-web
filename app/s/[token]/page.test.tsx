import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShareLinkPage from './page';

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  getPageViewWithToken: vi.fn(),
  getLegalShareDocument: vi.fn(),
  isPublicLegalHistoryVersion: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock('@/lib/api/server-client', () => ({
  createPublicShareLinkClient: vi.fn(() => ({ validate: mocks.validate })),
}));
vi.mock('@/lib/queries/page', () => ({ getPageViewWithToken: mocks.getPageViewWithToken }));
vi.mock('@/lib/queries/post', () => ({
  getPostViewWithToken: vi.fn(),
  getPostAllowedActions: vi.fn(),
}));
vi.mock('./legal-share-query', () => ({
  getLegalShareDocument: mocks.getLegalShareDocument,
  isPublicLegalHistoryVersion: mocks.isPublicLegalHistoryVersion,
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: vi.fn(async () => 'ko') }));
vi.mock('./PageShareContent', () => ({ PageShareContent: vi.fn(() => null) }));
vi.mock('./PageShareViewClient', () => ({ PageShareViewClient: vi.fn(() => null) }));
vi.mock('./PostShareViewClient', () => ({ PostShareViewClient: vi.fn(() => null) }));
vi.mock('./LegalShareViewClient', () => ({ LegalShareViewClient: vi.fn(() => null) }));

describe('/s/[token] Page share route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPublicLegalHistoryVersion.mockResolvedValue(false);
  });

  it('renders a Page password challenge without redirecting or reading the Page early', async () => {
    mocks.validate.mockResolvedValue({
      entityType: ShareLinkEntityType.PAGE,
      entityId: 'page-1',
      slug: 'shared-page',
      valid: false,
      passwordRequired: true,
    });

    const result = await ShareLinkPage({ params: Promise.resolve({ token: 'share-token' }) });

    expect(result.props).toMatchObject({
      token: 'share-token',
      idOrSlug: 'shared-page',
      requestedLocale: 'ko',
      initialState: {},
    });
    expect(mocks.getPageViewWithToken).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('reads an unprotected Page through Page share authority and renders it in place', async () => {
    const page = { id: 'page-1', slug: 'shared-page' };
    mocks.validate.mockResolvedValue({
      entityType: ShareLinkEntityType.PAGE,
      entityId: 'page-1',
      slug: 'shared-page',
      valid: true,
      passwordRequired: false,
    });
    mocks.getPageViewWithToken.mockResolvedValue(page);

    const result = await ShareLinkPage({ params: Promise.resolve({ token: 'share-token' }) });

    expect(mocks.getPageViewWithToken).toHaveBeenCalledWith('shared-page', 'share-token', 'ko');
    expect(result.props.initialState.content).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('returns not found when the Page share no longer resolves', async () => {
    mocks.validate.mockResolvedValue({
      entityType: ShareLinkEntityType.PAGE,
      entityId: 'page-1',
      slug: 'shared-page',
      valid: true,
      passwordRequired: false,
    });
    mocks.getPageViewWithToken.mockResolvedValue(null);

    await expect(ShareLinkPage({ params: Promise.resolve({ token: 'share-token' }) })).rejects.toThrow('not-found');
  });

  it('renders a legal password challenge without exposing the password in a redirect URL', async () => {
    mocks.validate.mockResolvedValue({
      entityType: ShareLinkEntityType.PRIVACY,
      entityId: 'privacy-version-1',
      valid: false,
      passwordRequired: true,
    });

    const result = await ShareLinkPage({ params: Promise.resolve({ token: 'privacy-token' }) });

    expect(result.props).toMatchObject({
      entityType: 'privacy',
      entityId: 'privacy-version-1',
      token: 'privacy-token',
      requestedLocale: 'ko',
      initialState: {},
    });
    expect(mocks.getLegalShareDocument).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('reads an unprotected scheduled legal version through the exact share authority', async () => {
    mocks.validate.mockResolvedValue({
      entityType: ShareLinkEntityType.TERMS,
      entityId: 'terms-version-1',
      valid: true,
      passwordRequired: false,
    });
    mocks.getLegalShareDocument.mockResolvedValue({
      entityType: 'terms',
      title: 'Upcoming terms',
      content: '<p>Terms</p>',
      version: 2,
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    });

    const result = await ShareLinkPage({ params: Promise.resolve({ token: 'terms-token' }) });

    expect(mocks.getLegalShareDocument).toHaveBeenCalledWith('terms', 'terms-version-1', 'terms-token', 'ko');
    expect(result.props.initialState.document).toEqual({
      entityType: 'terms',
      title: 'Upcoming terms',
      content: '<p>Terms</p>',
      version: 2,
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redirects an expired automatic legal preview token to the exact public history version', async () => {
    mocks.validate.mockResolvedValue({
      entityType: ShareLinkEntityType.PRIVACY,
      entityId: 'privacy-version-2',
      valid: true,
      passwordRequired: false,
    });
    mocks.getLegalShareDocument.mockResolvedValue(null);
    mocks.isPublicLegalHistoryVersion.mockResolvedValue(true);

    await expect(ShareLinkPage({ params: Promise.resolve({ token: 'privacy-token' }) })).rejects.toThrow(
      'redirect:/privacy/history/privacy-version-2',
    );

    expect(mocks.isPublicLegalHistoryVersion).toHaveBeenCalledWith('privacy', 'privacy-version-2', 'ko');
  });

  it('returns not found when a cancelled automatic legal preview token no longer validates', async () => {
    mocks.validate.mockResolvedValue({ valid: false, passwordRequired: false });

    await expect(ShareLinkPage({ params: Promise.resolve({ token: 'cancelled-token' }) })).rejects.toThrow('not-found');
    expect(mocks.getLegalShareDocument).not.toHaveBeenCalled();
    expect(mocks.isPublicLegalHistoryVersion).not.toHaveBeenCalled();
  });
});
