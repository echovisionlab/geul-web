import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { cache } from 'react';
import { FormAccessContext, FormAccessTarget, FormStatus } from '@echovisionlab/geul-proto/public/form_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { WorkStatus, WorkType } from '@echovisionlab/geul-proto/public/work_pb.ts';
import {
  createPublicArtistClientWithAuth,
  createPublicFormClientWithAuth,
  createPublicLabelClientWithAuth,
  createPublicPageClientWithAuth,
  createPublicPostClientWithAuth,
  createPublicReleaseClientWithAuth,
  createPublicMemberClient,
  createPublicWorkClientWithAuth,
} from '@/lib/api/server-client';
import { getManifestSnapshot } from '@/lib/queries/manifest';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { localizedRichTextPlainText } from '@/features/editor/contract/localized-rich-text-text';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import { resolveFeaturedImageDeliveryUrl, resolvePostFeaturedImageUrl } from '@/lib/media/post-featured-image';
import { getPublicCategoryBySlug, getPublicTagBySlug } from '@/lib/queries/taxonomy';
import { createLogger } from '@/lib/utils/logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';
import { isValidUuid } from '@/lib/utils/validation';

const logger = createLogger('metadata-queries');

export interface SiteMetadataDocument {
  siteTitle: string;
  siteDescription: string | null;
  canonicalOrigin: string;
  siteOgImageUrl: string | null;
  companyName: string | null;
  logoUrl: string | null;
  socialLinks: string[];
}

export interface MetadataLocalizationInfo {
  requestedLocale: string;
  displayedLocale: string;
  sourceLocale: string;
  isFallback: boolean;
  isOriginal: boolean;
  machineGenerated: boolean;
  fallbackReason: number;
  availableLocales?: string[];
}

interface MetadataLocation {
  id: string | null;
  name: string;
  lat: number;
  lng: number;
}

interface MetadataDocumentBase {
  id: string;
  title: string;
  summary: string | null;
  routePath: string;
  slug: string | null;
  featuredImageUrl: string | null;
  ogImageUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  site: SiteMetadataDocument;
  localizationInfo?: MetadataLocalizationInfo | null;
}

export interface HomeMetadataDocument {
  routePath: '/';
  title: string;
  summary: string | null;
  featuredImageUrl: string | null;
  ogImageUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  localizationInfo?: MetadataLocalizationInfo | null;
  site: SiteMetadataDocument;
}

export interface PostMetadataDocument extends MetadataDocumentBase {
  kind: 'post';
  authors: { id: string; name: string }[];
  categories: { id: string; name: string; slug: string | null }[];
  tags: { id: string; name: string; slug: string | null }[];
  series: { id: string; title: string; slug: string | null } | null;
  location: MetadataLocation | null;
}

export interface PageMetadataDocument extends MetadataDocumentBase {
  kind: 'page';
  showTitle: boolean;
}

export interface WorkMetadataDocument extends MetadataDocumentBase {
  kind: 'work';
  type: 'music_project' | 'portfolio' | 'article' | 'contribution';
  year: number;
  month: number;
  untilYear: number | null;
  untilMonth: number | null;
  isPresent: boolean;
  featured: boolean;
  location: MetadataLocation | null;
  credits: {
    id: string;
    groupId: string | null;
    name: string | null;
    creditRole: string | null;
    artist: { id: string; name: string; slug: string | null } | null;
    member: { id: string; name: string } | null;
  }[];
  clients: {
    id: string;
    name: string;
    website: string | null;
  }[];
}

export interface ArtistMetadataDocument {
  kind: 'artist';
  id: string;
  name: string;
  bio: string | null;
  slug: string | null;
  imageUrl: string | null;
  ogImageUrl: string | null;
  routePath: string;
  isGroup: boolean;
  socialLinks: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  localizationInfo?: MetadataLocalizationInfo | null;
  site: SiteMetadataDocument;
}

export interface FormMetadataDocument {
  kind: 'form';
  id: string;
  title: string;
  summary: string | null;
  slug: string | null;
  ogImageUrl: string | null;
  featuredImageUrl: string | null;
  routePath: string;
  localizationInfo?: MetadataLocalizationInfo | null;
  site: SiteMetadataDocument;
}

export interface MemberMetadataDocument {
  kind: 'member';
  id: string;
  name: string | null;
  bio: string | null;
  imageUrl: string | null;
  routePath: string;
  site: SiteMetadataDocument;
}

export interface LabelMetadataDocument {
  kind: 'label';
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  imageUrl: string | null;
  ogImageUrl: string | null;
  routePath: string;
  socialLinks: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  localizationInfo?: MetadataLocalizationInfo | null;
  site: SiteMetadataDocument;
}

export interface ReleaseMetadataDocument {
  kind: 'release';
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  type: 'album' | 'ep' | 'single' | 'compilation';
  artworkUrl: string | null;
  ogImageUrl: string | null;
  routePath: string;
  artists: { id: string; name: string; slug: string | null }[];
  releaseDate: Date | null;
  publishedAt: Date | null;
  localizationInfo?: MetadataLocalizationInfo | null;
  site: SiteMetadataDocument;
}

export interface TaxonomyMetadataDocument {
  kind: 'taxonomy';
  taxonomy: 'category' | 'tag';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  routePath: string;
  site: SiteMetadataDocument;
}

interface FormMetadata {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  ogImageUrl: string | null;
  featuredImageUrl: string | null;
  localizationInfo?: MetadataLocalizationInfo | null;
}

interface MemberMetadata {
  id: string;
  name: string | null;
  bio: string | null;
  image: string | null;
}

interface LocalizedMetadataQueryOptions {
  preferSourceLocale?: boolean;
  requestedLocale?: string | null;
}

function normalizeRequestedLocale(requestedLocale: string | null | undefined): string | null {
  return requestedLocale?.trim() || null;
}

function normalizeCanonicalOrigin(siteOrigin: string | null | undefined): string {
  const trimmed = siteOrigin?.trim();
  if (!trimmed) {
    throw new Error('Manifest site_origin is required');
  }
  return trimmed.replace(/\/+$/, '');
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toLocationDocument(
  place?: {
    id?: string | null;
    name: string;
    lat: number;
    lng: number;
  } | null,
): MetadataLocation | null {
  if (!place) {
    return null;
  }

  return {
    id: place.id ?? null,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
  };
}

function toWorkTypeString(type: WorkType): WorkMetadataDocument['type'] {
  switch (type) {
    case WorkType.MUSIC_PROJECT:
      return 'music_project';
    case WorkType.PORTFOLIO:
      return 'portfolio';
    case WorkType.ARTICLE:
      return 'article';
    case WorkType.CONTRIBUTION:
      return 'contribution';
    default:
      return 'music_project';
  }
}

const getSiteMetadataDocumentCached = cache(async (requestedLocale: string | null): Promise<SiteMetadataDocument> => {
  try {
    const { manifest, hasSettings } = await getManifestSnapshot({ requestedLocale });
    if (!hasSettings) {
      throw new Error('Manifest settings are required for site metadata');
    }
    const { settings } = manifest;

    return {
      siteTitle: settings.site_title,
      siteDescription: normalizeOptionalString(settings.meta_description),
      canonicalOrigin: normalizeCanonicalOrigin(settings.site_origin),
      siteOgImageUrl: normalizeOptionalString(settings.site_og_image_url),
      companyName: normalizeOptionalString(settings.company_name),
      logoUrl: settings.logo_url,
      socialLinks: Object.values(settings.social_links ?? {}).filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      ),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetSiteMetadataDocument RPC error', { error: err.message });
    }

    throw err;
  }
});

export function getSiteMetadataDocument(options?: { requestedLocale?: string | null }): Promise<SiteMetadataDocument> {
  return getSiteMetadataDocumentCached(normalizeRequestedLocale(options?.requestedLocale));
}

const getHomeMetadataDocumentCached = cache(async (requestedLocale: string | null): Promise<HomeMetadataDocument> => {
  const client = await createPublicPageClientWithAuth(requestedLocale);
  const [site, response] = await Promise.all([
    getSiteMetadataDocument({ requestedLocale }),
    client.get({ slug: '/' }).catch((err) => {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      throw err;
    }),
  ]);

  const page = response?.page;
  if (!page || page.status !== PageStatus.PUBLISHED) {
    return {
      routePath: '/',
      title: site.siteTitle || 'Home',
      summary: site.siteDescription,
      featuredImageUrl: null,
      ogImageUrl: site.siteOgImageUrl,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      site,
    };
  }

  const localizationInfo = mapPublicLocalizationInfo(page.localizationInfo);
  const isCurrentTarget = Boolean(
    localizationInfo?.displayedLocale &&
    localizationInfo.sourceLocale &&
    localizationInfo.displayedLocale !== localizationInfo.sourceLocale,
  );

  return {
    routePath: '/',
    title: isCurrentTarget ? page.title : site.siteTitle || page.title,
    summary: isCurrentTarget ? (page.summary ?? null) : (site.siteDescription ?? page.summary ?? null),
    featuredImageUrl:
      isCurrentTarget || site.siteOgImageUrl ? null : resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
    ogImageUrl: isCurrentTarget ? (page.ogAsset?.url ?? null) : (site.siteOgImageUrl ?? page.ogAsset?.url ?? null),
    createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
    updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
    publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
    localizationInfo,
    site,
  };
});

export function getHomeMetadataDocument(options?: { requestedLocale?: string | null }): Promise<HomeMetadataDocument> {
  return getHomeMetadataDocumentCached(normalizeRequestedLocale(options?.requestedLocale));
}

const getPostMetadataDocumentCached = cache(
  async (
    idOrSlug: string,
    preferSourceLocale: boolean,
    requestedLocale: string | null,
  ): Promise<PostMetadataDocument | null> => {
    try {
      const requestedSlug = decodeURIComponent(idOrSlug);
      const client = await createPublicPostClientWithAuth(requestedLocale);
      const [site, response] = await Promise.all([
        getSiteMetadataDocument({ requestedLocale }),
        client.get({ slug: requestedSlug }),
      ]);
      const localizedResponse = await maybeFetchSourceLocale({
        preferSourceLocale,
        initialResponse: response,
        entity: response.post ?? null,
        fetchWithLocale: async (locale) => {
          const sourceClient = await createPublicPostClientWithAuth(locale);
          return sourceClient.get({ slug: requestedSlug });
        },
      });

      const post = localizedResponse.post;
      if (!post || (post.status !== PostStatus.PUBLISHED && post.status !== PostStatus.ARCHIVED)) {
        return null;
      }

      const slug = post.slug ?? null;

      return {
        kind: 'post',
        id: post.id,
        title: post.title,
        summary: post.summary ?? null,
        routePath: `/posts/${slug || post.id}`,
        slug,
        featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
        ogImageUrl: post.ogAsset?.url ?? null,
        createdAt: post.createdAt ? timestampDate(post.createdAt) : null,
        updatedAt: post.updatedAt ? timestampDate(post.updatedAt) : null,
        publishedAt: post.publishedAt ? timestampDate(post.publishedAt) : null,
        localizationInfo: mapPublicLocalizationInfo(post.localizationInfo),
        authors: (post.authorMembers ?? []).map((author) => ({
          id: author.id,
          name: author.nickname,
        })),
        categories: (post.categories ?? []).map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug ?? null,
        })),
        tags: (post.tags ?? []).map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug ?? null,
        })),
        series: post.series
          ? {
              id: post.series.id,
              title: post.series.title,
              slug: post.series.slug ?? null,
            }
          : null,
        location: toLocationDocument(post.locationPlace ?? null),
        site,
      };
    } catch (err) {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      logger.error('GetPostMetadataDocument error', { error: err });
      return null;
    }
  },
);

export function getPostMetadataDocument(
  idOrSlug: string,
  options?: LocalizedMetadataQueryOptions,
): Promise<PostMetadataDocument | null> {
  return getPostMetadataDocumentCached(
    idOrSlug,
    options?.preferSourceLocale ?? false,
    normalizeRequestedLocale(options?.requestedLocale),
  );
}

const getPageMetadataDocumentCached = cache(
  async (
    idOrSlug: string,
    preferSourceLocale: boolean,
    requestedLocale: string | null,
  ): Promise<PageMetadataDocument | null> => {
    try {
      const requestedSlug = decodeURIComponent(idOrSlug);
      const client = await createPublicPageClientWithAuth(requestedLocale);
      const [site, response] = await Promise.all([
        getSiteMetadataDocument({ requestedLocale }),
        client.get({ slug: requestedSlug }),
      ]);
      const localizedResponse = await maybeFetchSourceLocale({
        preferSourceLocale,
        initialResponse: response,
        entity: response.page ?? null,
        fetchWithLocale: async (locale) => {
          const sourceClient = await createPublicPageClientWithAuth(locale);
          return sourceClient.get({ slug: requestedSlug });
        },
      });

      const page = localizedResponse.page;
      if (!page || page.status !== PageStatus.PUBLISHED) {
        return null;
      }

      const slug = page.slug ?? null;

      return {
        kind: 'page',
        id: page.id,
        title: page.title,
        summary: page.summary ?? null,
        routePath: slug && slug !== '/' ? `/${slug}` : '/',
        slug,
        showTitle: page.showTitle,
        featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
        ogImageUrl: page.ogAsset?.url ?? null,
        createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
        updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
        publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
        localizationInfo: mapPublicLocalizationInfo(page.localizationInfo),
        site,
      };
    } catch (err) {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      logger.error('GetPageMetadataDocument error', { error: err });
      return null;
    }
  },
);

export function getPageMetadataDocument(
  idOrSlug: string,
  options?: LocalizedMetadataQueryOptions,
): Promise<PageMetadataDocument | null> {
  return getPageMetadataDocumentCached(
    idOrSlug,
    options?.preferSourceLocale ?? false,
    normalizeRequestedLocale(options?.requestedLocale),
  );
}

const getWorkMetadataDocumentCached = cache(
  async (
    idOrSlug: string,
    preferSourceLocale: boolean,
    requestedLocale: string | null,
  ): Promise<WorkMetadataDocument | null> => {
    try {
      const requestedSlug = decodeURIComponent(idOrSlug);
      const client = await createPublicWorkClientWithAuth(requestedLocale);
      const [site, response] = await Promise.all([
        getSiteMetadataDocument({ requestedLocale }),
        client.get({ slug: requestedSlug }),
      ]);
      const localizedResponse = await maybeFetchSourceLocale({
        preferSourceLocale,
        initialResponse: response,
        entity: response.work ?? null,
        fetchWithLocale: async (locale) => {
          const sourceClient = await createPublicWorkClientWithAuth(locale);
          return sourceClient.get({ slug: requestedSlug });
        },
      });

      const work = localizedResponse.work;
      if (!work || (work.status !== WorkStatus.PUBLISHED && work.status !== WorkStatus.ARCHIVED)) {
        return null;
      }

      const slug = work.slug ?? null;

      return {
        kind: 'work',
        id: work.id,
        title: work.title,
        summary: work.summary ?? null,
        routePath: `/works/${slug || work.id}`,
        slug,
        type: toWorkTypeString(work.type ?? WorkType.UNSPECIFIED),
        year: work.year,
        month: work.month,
        untilYear: work.untilYear ?? null,
        untilMonth: work.untilMonth ?? null,
        isPresent: work.isPresent,
        featured: work.featured,
        featuredImageUrl: work.featuredImageAsset?.url ?? null,
        ogImageUrl: work.ogAsset?.url ?? null,
        createdAt: work.createdAt ? timestampDate(work.createdAt) : null,
        updatedAt: work.updatedAt ? timestampDate(work.updatedAt) : null,
        publishedAt: work.publishedAt ? timestampDate(work.publishedAt) : null,
        localizationInfo: mapPublicLocalizationInfo(work.localizationInfo),
        location: toLocationDocument(work.locationPlace ?? null),
        credits: (work.credits ?? []).map((credit) => ({
          id: credit.id,
          groupId: credit.groupId ?? null,
          name: credit.name ?? null,
          creditRole: credit.creditRole ?? null,
          artist: credit.artist
            ? {
                id: credit.artist.id,
                name: credit.artist.name,
                slug: credit.artist.slug ?? null,
              }
            : null,
          member: credit.member
            ? {
                id: credit.member.id,
                name: credit.member.nickname,
              }
            : null,
        })),
        clients: (work.clients ?? []).map((clientData) => ({
          id: clientData.id,
          name: clientData.name,
          website: clientData.website ?? null,
        })),
        site,
      };
    } catch (err) {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      logger.error('GetWorkMetadataDocument error', { error: err });
      return null;
    }
  },
);

export function getWorkMetadataDocument(
  idOrSlug: string,
  options?: LocalizedMetadataQueryOptions,
): Promise<WorkMetadataDocument | null> {
  return getWorkMetadataDocumentCached(
    idOrSlug,
    options?.preferSourceLocale ?? false,
    normalizeRequestedLocale(options?.requestedLocale),
  );
}

const getArtistMetadataDocumentCached = cache(
  async (
    idOrSlug: string,
    preferSourceLocale: boolean,
    requestedLocale: string | null,
  ): Promise<ArtistMetadataDocument | null> => {
    try {
      const slugOrUUID = isValidUuid(idOrSlug) ? idOrSlug : decodeURIComponent(idOrSlug);
      const client = await createPublicArtistClientWithAuth(requestedLocale);
      const site = await getSiteMetadataDocument({ requestedLocale });
      let response = await client.get({ slug: slugOrUUID });
      response = await maybeFetchSourceLocale({
        preferSourceLocale,
        initialResponse: response,
        entity: response.artist ?? null,
        fetchWithLocale: async (locale) => {
          const sourceClient = await createPublicArtistClientWithAuth(locale);
          return sourceClient.get({ slug: slugOrUUID });
        },
      });
      const artist = response.artist;

      if (!artist) {
        return null;
      }

      const slug = artist.slug ?? null;
      const content = artist.document ? materializeLocalizedRichTextTree(artist.document) : [];

      return {
        kind: 'artist',
        id: artist.id,
        name: artist.name,
        bio: localizedRichTextPlainText(content) || null,
        slug,
        imageUrl: artist.imageAsset?.url ?? null,
        ogImageUrl: artist.ogAsset?.url ?? null,
        routePath: `/artists/${slug || artist.id}`,
        isGroup: artist.isGroup,
        socialLinks: Object.values(artist.socialLinks ?? {}).filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        ),
        createdAt: artist.createdAt ? timestampDate(artist.createdAt) : null,
        updatedAt: artist.updatedAt ? timestampDate(artist.updatedAt) : null,
        publishedAt: artist.publishedAt ? timestampDate(artist.publishedAt) : null,
        localizationInfo: mapPublicLocalizationInfo(artist.localizationInfo),
        site,
      };
    } catch (err) {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      logger.error('GetArtistMetadataDocument error', { error: err });
      return null;
    }
  },
);

export function getArtistMetadataDocument(
  idOrSlug: string,
  options?: LocalizedMetadataQueryOptions,
): Promise<ArtistMetadataDocument | null> {
  return getArtistMetadataDocumentCached(
    idOrSlug,
    options?.preferSourceLocale ?? false,
    normalizeRequestedLocale(options?.requestedLocale),
  );
}

const getFormMetadataDocumentCached = cache(
  async (slugOrId: string, requestedLocale: string | null): Promise<FormMetadataDocument | null> => {
    const [site, form] = await Promise.all([
      getSiteMetadataDocument({ requestedLocale }),
      getFormMetadata(slugOrId, { requestedLocale }),
    ]);

    if (!form) {
      return null;
    }

    return {
      kind: 'form',
      id: form.id,
      title: form.title,
      summary: null,
      slug: form.slug,
      ogImageUrl: form.ogImageUrl,
      featuredImageUrl: form.featuredImageUrl,
      routePath: `/forms/${form.slug || form.id}`,
      localizationInfo: form.localizationInfo ?? null,
      site,
    };
  },
);

export function getFormMetadataDocument(
  slugOrId: string,
  options?: { requestedLocale?: string | null },
): Promise<FormMetadataDocument | null> {
  return getFormMetadataDocumentCached(slugOrId, normalizeRequestedLocale(options?.requestedLocale));
}

const getMemberMetadataDocumentCached = cache(async (memberId: string): Promise<MemberMetadataDocument | null> => {
  const [site, member] = await Promise.all([getSiteMetadataDocument(), getMemberMetadata(memberId)]);

  if (!member) {
    return null;
  }

  return {
    kind: 'member',
    id: member.id,
    name: member.name,
    bio: member.bio,
    imageUrl: member.image,
    routePath: `/user/${member.id}`,
    site,
  };
});

export function getMemberMetadataDocument(memberId: string): Promise<MemberMetadataDocument | null> {
  return getMemberMetadataDocumentCached(memberId);
}

const getLabelMetadataDocumentCached = cache(
  async (
    idOrSlug: string,
    preferSourceLocale: boolean,
    requestedLocale: string | null,
  ): Promise<LabelMetadataDocument | null> => {
    try {
      const client = await createPublicLabelClientWithAuth(requestedLocale);
      const [site, initialResponse] = await Promise.all([
        getSiteMetadataDocument({ requestedLocale }),
        client.get({ slug: decodeURIComponent(idOrSlug) }),
      ]);
      const response = await maybeFetchSourceLocale({
        preferSourceLocale,
        initialResponse,
        entity: initialResponse.label ?? null,
        fetchWithLocale: async (locale) => {
          const sourceClient = await createPublicLabelClientWithAuth(locale);
          return sourceClient.get({ slug: decodeURIComponent(idOrSlug) });
        },
      });
      const label = response.label;

      if (!label) {
        return null;
      }

      const slug = label.slug ?? null;
      const content = label.document ? materializeLocalizedRichTextTree(label.document) : [];

      return {
        kind: 'label',
        id: label.id,
        name: label.name,
        description: localizedRichTextPlainText(content) || null,
        slug,
        imageUrl: themedAssetRefUrl(label.imageLightAsset, label.imageDarkAsset),
        ogImageUrl: label.ogAsset?.url ?? null,
        routePath: `/labels/${slug || label.id}`,
        socialLinks: Object.values(label.socialLinks ?? {}).filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        ),
        createdAt: label.createdAt ? timestampDate(label.createdAt) : null,
        updatedAt: label.updatedAt ? timestampDate(label.updatedAt) : null,
        publishedAt: label.publishedAt ? timestampDate(label.publishedAt) : null,
        localizationInfo: mapPublicLocalizationInfo(label.localizationInfo),
        site,
      };
    } catch (err) {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      logger.error('GetLabelMetadataDocument error', { error: err });
      return null;
    }
  },
);

export function getLabelMetadataDocument(
  idOrSlug: string,
  options?: LocalizedMetadataQueryOptions,
): Promise<LabelMetadataDocument | null> {
  return getLabelMetadataDocumentCached(
    idOrSlug,
    options?.preferSourceLocale ?? false,
    normalizeRequestedLocale(options?.requestedLocale),
  );
}

const getReleaseMetadataDocumentCached = cache(
  async (
    idOrSlug: string,
    preferSourceLocale: boolean,
    requestedLocale: string | null,
  ): Promise<ReleaseMetadataDocument | null> => {
    try {
      const client = await createPublicReleaseClientWithAuth(requestedLocale);
      const [site, initialResponse] = await Promise.all([
        getSiteMetadataDocument({ requestedLocale }),
        client.get({ slug: decodeURIComponent(idOrSlug) }),
      ]);
      const response = await maybeFetchSourceLocale({
        preferSourceLocale,
        initialResponse,
        entity: initialResponse.release ?? null,
        fetchWithLocale: async (locale) => {
          const sourceClient = await createPublicReleaseClientWithAuth(locale);
          return sourceClient.get({ slug: decodeURIComponent(idOrSlug) });
        },
      });
      const release = response.release;

      if (!release) {
        return null;
      }

      const slug = release.slug ?? null;
      const content = release.document ? materializeLocalizedRichTextTree(release.document) : [];

      return {
        kind: 'release',
        id: release.id,
        title: release.title,
        description: localizedRichTextPlainText(content) || null,
        slug,
        type: release.type === 1 ? 'album' : release.type === 2 ? 'ep' : release.type === 3 ? 'single' : 'compilation',
        artworkUrl: release.artworkAsset?.url ?? null,
        ogImageUrl: release.artworkAsset?.url ?? null,
        routePath: `/releases/${slug || release.id}`,
        artists: (release.artists ?? []).map((artist) => ({
          id: artist.id,
          name: artist.name,
          slug: artist.slug ?? null,
        })),
        releaseDate: release.releaseDate ? timestampDate(release.releaseDate) : null,
        publishedAt: release.publishedAt ? timestampDate(release.publishedAt) : null,
        localizationInfo: mapPublicLocalizationInfo(release.localizationInfo),
        site,
      };
    } catch (err) {
      if (isConnectErrorCode(err, Code.NotFound)) {
        return null;
      }
      logger.error('GetReleaseMetadataDocument error', { error: err });
      return null;
    }
  },
);

export function getReleaseMetadataDocument(
  idOrSlug: string,
  options?: LocalizedMetadataQueryOptions,
): Promise<ReleaseMetadataDocument | null> {
  return getReleaseMetadataDocumentCached(
    idOrSlug,
    options?.preferSourceLocale ?? false,
    normalizeRequestedLocale(options?.requestedLocale),
  );
}

const getCategoryMetadataDocumentCached = cache(async (slug: string): Promise<TaxonomyMetadataDocument | null> => {
  const [site, category] = await Promise.all([getSiteMetadataDocument(), getPublicCategoryBySlug(slug)]);

  if (!category) {
    return null;
  }

  return {
    kind: 'taxonomy',
    taxonomy: 'category',
    id: category.id,
    name: category.name,
    description: category.description ?? null,
    slug: category.slug,
    routePath: `/category/${category.slug}`,
    site,
  };
});

export function getCategoryMetadataDocument(slug: string): Promise<TaxonomyMetadataDocument | null> {
  return getCategoryMetadataDocumentCached(slug);
}

const getTagMetadataDocumentCached = cache(async (slug: string): Promise<TaxonomyMetadataDocument | null> => {
  const [site, tag] = await Promise.all([getSiteMetadataDocument(), getPublicTagBySlug(slug)]);

  if (!tag) {
    return null;
  }

  return {
    kind: 'taxonomy',
    taxonomy: 'tag',
    id: tag.id,
    name: tag.name,
    description: null,
    slug: tag.slug,
    routePath: `/tag/${tag.slug}`,
    site,
  };
});

export function getTagMetadataDocument(slug: string): Promise<TaxonomyMetadataDocument | null> {
  return getTagMetadataDocumentCached(slug);
}

async function getFormMetadata(
  slugOrId: string,
  options?: { requestedLocale?: string | null },
): Promise<FormMetadata | null> {
  try {
    const client = await createPublicFormClientWithAuth(options?.requestedLocale);
    const response = await client.checkAccess({
      slug: decodeURIComponent(slugOrId),
      context: FormAccessContext.URL,
      target: FormAccessTarget.FORM,
    });
    const form = response.form;
    if (!form || form.status !== FormStatus.PUBLISHED) {
      return null;
    }

    return {
      id: form.id,
      title: form.title,
      slug: form.slug ?? null,
      status: 'published',
      ogImageUrl: form.ogAsset?.url ?? null,
      featuredImageUrl: form.featuredImageAsset?.url ?? null,
      localizationInfo: form.localizationInfo ? mapPublicLocalizationInfo(form.localizationInfo) : null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.NotFound || err.code === Code.Unauthenticated || err.code === Code.PermissionDenied) {
        return null;
      }
    }
    logger.error('GetFormMetadata error', { error: err });
    return null;
  }
}

async function getMemberMetadata(memberId: string): Promise<MemberMetadata | null> {
  try {
    const client = createPublicMemberClient();
    const response = await client.getPublicMember({ memberId });
    const member = response.member;
    const summary = member?.summary;
    if (!member || !summary || !summary.id || !summary.nickname.trim()) {
      return null;
    }

    return {
      id: summary.id,
      name: summary.nickname,
      bio: member.bio ?? null,
      image: summary.avatarAsset?.url ?? null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('GetMemberMetadata error', { error: err });
    return null;
  }
}
