import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import LabelViewPage from './page';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getLabelForEdit: vi.fn(),
  getLabelPublic: vi.fn(),
  validateShareLink: vi.fn(),
  labelPublicContent: vi.fn(() => null),
  labelShareViewClient: vi.fn(() => null),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/queries/label', () => ({
  getLabelForEdit: mocks.getLabelForEdit,
  getLabelPublic: mocks.getLabelPublic,
}));
vi.mock('@/lib/queries/metadata', () => ({ getLabelMetadataDocument: vi.fn(async () => null) }));
vi.mock('@/lib/api/server-client', () => ({
  createPublicShareLinkClient: vi.fn(() => ({ validate: mocks.validateShareLink })),
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/utils/header.server', () => ({ getRequestHeaders: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));
vi.mock('@/features/label/AdminLabelDetailClient', () => ({
  AdminLabelDetailClient: vi.fn(() => null),
}));
vi.mock('./LabelPublicContent', () => ({ LabelPublicContent: mocks.labelPublicContent }));
vi.mock('./LabelShareViewClient', () => ({ LabelShareViewClient: mocks.labelShareViewClient }));

function props(
  searchParams: Record<string, string | string[] | undefined> = { edit: 'true' },
  idOrSlug = 'label-slug',
) {
  return {
    params: Promise.resolve({ idOrSlug }),
    searchParams: Promise.resolve(searchParams),
  };
}

describe('Label canonical editor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Owner', role: 'user' } });
    mocks.getLabelForEdit.mockResolvedValue({ id: 'label-1', slug: 'label-slug', name: 'Label' });
  });

  it('redirects an anonymous edit request to login with the exact route before entity lookup', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(LabelViewPage(props({ edit: 'true', lang: 'ja' }))).rejects.toThrow(
      'redirect:/login?redirect=%2Flabels%2Flabel-slug%3Fedit%3Dtrue%26lang%3Dja',
    );
    expect(mocks.getLabelForEdit).not.toHaveBeenCalled();
  });

  it('returns not found for both missing and unauthorized labels', async () => {
    mocks.getLabelForEdit.mockResolvedValue(null);

    await expect(LabelViewPage(props())).rejects.toThrow('not-found');
  });

  it('canonicalizes an authorized slug to the immutable ID after the authority-enforcing lookup', async () => {
    await expect(LabelViewPage(props({ edit: 'true', lang: 'ko' }))).rejects.toThrow(
      'redirect:/labels/label-1?edit=true&lang=ko',
    );

    expect(mocks.getLabelForEdit).toHaveBeenCalledWith('label-slug');
  });

  it('renders the existing editor at its immutable ID', async () => {
    const result = await LabelViewPage(props({ edit: 'true' }, 'label-1'));

    expect(mocks.getLabelForEdit).toHaveBeenCalledWith('label-1');
    expect(result.props).toMatchObject({
      id: 'label-1',
      backHref: '/labels/label-slug',
    });
  });
});

describe('Label public ShareLink route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLabelPublic.mockResolvedValue({ id: 'label-1', slug: 'label-slug', name: 'Label' });
  });

  it('renders a draft Label through a valid unprotected ShareLink', async () => {
    mocks.validateShareLink.mockResolvedValue({
      entityType: ShareLinkEntityType.LABEL,
      valid: true,
      passwordRequired: false,
    });

    const result = await LabelViewPage(props({ share: 'share-token', lang: 'ko' }));

    expect(mocks.validateShareLink).toHaveBeenCalledWith({ token: 'share-token' });
    expect(mocks.getLabelPublic).toHaveBeenCalledWith('label-slug', 'share-token', { requestedLocale: 'ko' });
    expect(result.type).toBe(mocks.labelPublicContent);
    expect(result.props).toMatchObject({ query: { share: 'share-token', lang: 'ko' } });
  });

  it('renders the Label password gate when the ShareLink requires a password', async () => {
    mocks.validateShareLink.mockResolvedValue({
      entityType: ShareLinkEntityType.LABEL,
      valid: false,
      passwordRequired: true,
    });

    const result = await LabelViewPage(props({ share: 'protected-token' }));

    expect(result.type).toBe(mocks.labelShareViewClient);
    expect(result.props).toMatchObject({ token: 'protected-token', idOrSlug: 'label-slug' });
    expect(mocks.getLabelPublic).not.toHaveBeenCalled();
  });

  it('hides invalid and cross-domain ShareLinks as not found', async () => {
    mocks.validateShareLink.mockResolvedValue({
      entityType: ShareLinkEntityType.ARTIST,
      valid: true,
      passwordRequired: false,
    });

    await expect(LabelViewPage(props({ share: 'wrong-domain' }))).rejects.toThrow('not-found');
    expect(mocks.getLabelPublic).not.toHaveBeenCalled();
  });
});
