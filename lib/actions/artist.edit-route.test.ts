import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createArtistClient: vi.fn(),
  createPublicArtistClient: vi.fn(),
  createPublicArtistClientWithAuth: vi.fn(),
  regenerateOgImageAction: vi.fn(),
}));
const artistClient = vi.hoisted(() => ({
  getArtistEditorData: vi.fn(),
  listArtists: vi.fn(),
  listMyArtists: vi.fn(),
}));
const publicArtistClient = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  createArtistClient: mocks.createArtistClient,
  createPublicArtistClient: mocks.createPublicArtistClient,
  createPublicArtistClientWithAuth: mocks.createPublicArtistClientWithAuth,
}));
vi.mock('@/lib/i18n/default-entity-name.server', () => ({ getLocalizedNewEntityName: vi.fn() }));
vi.mock('@/lib/actions/og-generation', () => ({ regenerateOgImageAction: mocks.regenerateOgImageAction }));

import { getArtistAdminAction, listArtistParentOptionsAction, regenerateArtistOgImageAction } from './artist';

describe('Artist edit target lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createArtistClient.mockResolvedValue(artistClient);
    mocks.createPublicArtistClientWithAuth.mockResolvedValue(publicArtistClient);
    publicArtistClient.get.mockResolvedValue({
      artist: { id: '00000000-0000-4000-8000-000000000003', slug: 'artist-slug' },
    });
    artistClient.getArtistEditorData.mockResolvedValue({
      artist: {
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Artist',
        slug: 'artist-slug',
        socialLinks: {},
        status: 'draft',
        parentArtistId: '00000000-0000-4000-8000-000000000004',
      },
      labelIds: [],
    });
    mocks.regenerateOgImageAction.mockResolvedValue({ runId: 'run-1', generationIds: ['generation-1'] });
  });

  it('resolves an authorized slug before requesting manage editor data', async () => {
    await expect(getArtistAdminAction('artist-slug')).resolves.toMatchObject({
      id: '00000000-0000-4000-8000-000000000003',
      slug: 'artist-slug',
      parentArtistId: '00000000-0000-4000-8000-000000000004',
    });

    expect(publicArtistClient.get).toHaveBeenCalledWith({ slug: 'artist-slug' });
    expect(artistClient.getArtistEditorData).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000003',
    });
  });

  it('merges published and manageable parent options without the current Artist', async () => {
    artistClient.listArtists.mockResolvedValue({
      artists: [
        { id: 'artist-current', name: 'Current' },
        { id: 'artist-public', name: 'Public' },
      ],
    });
    artistClient.listMyArtists.mockResolvedValue({
      artists: [
        { id: 'artist-public', name: 'Public' },
        { id: 'artist-draft', name: 'Draft' },
      ],
    });

    await expect(listArtistParentOptionsAction('artist-current')).resolves.toEqual([
      { id: 'artist-draft', name: 'Draft' },
      { id: 'artist-public', name: 'Public' },
    ]);
  });

  it('requests the exact Artist locale OG target and returns its generation identity', async () => {
    await expect(regenerateArtistOgImageAction('artist-1', 'fr')).resolves.toEqual({
      success: true,
      runId: 'run-1',
      generationId: 'generation-1',
    });
    expect(mocks.regenerateOgImageAction).toHaveBeenCalledWith({
      entityType: 'artist',
      entityId: 'artist-1',
      selection: { type: 'locale', locale: 'fr' },
    });
  });
});
