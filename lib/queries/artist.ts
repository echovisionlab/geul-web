import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createPublicArtistClientWithAuth } from '@/lib/api/server-client';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import { createLogger } from '@/lib/utils/logger';
import { isValidUuid } from '@/lib/utils/validation';

const logger = createLogger('artist-queries');

const ARTIST_DETAIL_LIST_LIMIT = 500;

// === Public View Queries ===

// Get artist for public view page (by ID or slug)
export async function getArtistView(
  idOrSlug: string,
  options?: {
    preferSourceLocale?: boolean;
    requestedLocale?: string | null;
    shareToken?: string;
    sharePassword?: string;
  },
) {
  try {
    const slug = isValidUuid(idOrSlug) ? idOrSlug : decodeURIComponent(idOrSlug);
    const client = await createPublicArtistClientWithAuth(options?.requestedLocale);
    let response = await client.get({ slug, shareToken: options?.shareToken, sharePassword: options?.sharePassword });
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.artist ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicArtistClientWithAuth(locale);
        return sourceClient.get({ slug, shareToken: options?.shareToken, sharePassword: options?.sharePassword });
      },
    });
    const artist = response.artist;
    if (!artist) {
      return null;
    }

    const worksClient = await createPublicArtistClientWithAuth(
      artist.localizationInfo?.displayedLocale ?? options?.requestedLocale ?? null,
    );
    const [worksResponse, releasesResponse] = await Promise.all([
      worksClient.getWorks({ artistId: artist.id, limit: ARTIST_DETAIL_LIST_LIMIT }),
      worksClient.getReleases({ artistId: artist.id, limit: ARTIST_DETAIL_LIST_LIMIT }),
    ]);

    return {
      id: artist.id,
      name: artist.name,
      slug: artist.slug ?? null,
      realName: artist.realName ?? null,
      content: artist.document ? materializeLocalizedRichTextTree(artist.document) : null,
      countryCode: artist.countryCode ?? null,
      website: artist.website ?? null,
      imageUrl: artist.imageAsset?.url ?? null,
      images: (artist.images ?? []).map((image) => ({
        fileId: image.fileId,
        url: image.asset?.url ?? null,
        sortOrder: image.sortOrder,
        primary: image.primary,
      })),
      socialLinks: artist.socialLinks ?? {},
      isGroup: artist.isGroup,
      localizationInfo: mapPublicLocalizationInfo(artist.localizationInfo),
      labels: (artist.labels ?? []).map((label) => ({
        id: label.id,
        name: label.name,
        slug: label.slug ?? null,
      })),
      works: (worksResponse.works ?? []).map((work) => ({
        id: work.id,
        title: work.title,
        slug: work.slug ?? null,
        type: 'music_project',
        featuredImageUrl: work.imageAsset?.url ?? null,
      })),
      releases: (releasesResponse.releases ?? []).map((release) => ({
        id: release.id,
        title: release.title,
        slug: release.slug ?? null,
        type: release.type,
        artworkUrl: release.artworkAsset?.url ?? null,
        releaseDate: release.releaseDate ? timestampDate(release.releaseDate) : null,
        artists: (release.artists ?? []).map((releaseArtist) => ({
          id: releaseArtist.id,
          name: releaseArtist.name,
          slug: releaseArtist.slug ?? null,
        })),
      })),
      tracks: [] as { id: string; title: string; roleName: string }[],
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('Failed to get artist view', { error: err });
    return null;
  }
}
