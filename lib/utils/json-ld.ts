import type {
  ArtistMetadataDocument,
  HomeMetadataDocument,
  LabelMetadataDocument,
  PageMetadataDocument,
  PostMetadataDocument,
  ReleaseMetadataDocument,
  SiteMetadataDocument,
  TaxonomyMetadataDocument,
  WorkMetadataDocument,
} from '@/lib/queries/metadata';
import { resolveLocalizedMetadataSummary } from '@/lib/translation/metadata';
import { truncateForDescription } from '@/lib/utils/og';
import { joinUrl } from '@/lib/utils/url';

type JsonLdValue = Record<string, unknown>;

interface BreadcrumbItem {
  name: string;
  url: string;
}

function resolveCanonicalUrl(params: { canonicalOrigin: string; routePath: string }) {
  return joinUrl(params.canonicalOrigin, params.routePath);
}

function normalizeDescription(description?: string | null) {
  const normalized = truncateForDescription(description ?? null);
  return normalized || undefined;
}

function organizationId(site: SiteMetadataDocument) {
  return `${site.canonicalOrigin}/#organization`;
}

function websiteId(site: SiteMetadataDocument) {
  return `${site.canonicalOrigin}/#website`;
}

function webpageId(canonical: string) {
  return `${canonical}#webpage`;
}

function articleId(canonical: string) {
  return `${canonical}#article`;
}

function creativeWorkId(canonical: string) {
  return `${canonical}#creativework`;
}

function artistId(canonical: string) {
  return `${canonical}#person`;
}

function organizationEntityId(canonical: string) {
  return `${canonical}#organization`;
}

function albumId(canonical: string) {
  return `${canonical}#album`;
}

function collectionPageId(canonical: string) {
  return `${canonical}#collectionpage`;
}

function eventId(canonical: string) {
  return `${canonical}#event`;
}

function eventSeriesId(canonical: string) {
  return `${canonical}#eventseries`;
}

function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdValue | null {
  if (items.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildImageValue(url?: string | null) {
  return url?.trim() || undefined;
}

function baseCreativeWorkFields(params: {
  canonical: string;
  id: string;
  site: SiteMetadataDocument;
  title: string;
  description?: string;
  image?: string;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
}) {
  return {
    url: params.canonical,
    name: params.title,
    description: params.description,
    image: params.image,
    datePublished: params.publishedAt?.toISOString(),
    dateModified: params.updatedAt?.toISOString(),
    publisher: { '@id': organizationId(params.site) },
    isPartOf: { '@id': websiteId(params.site) },
    mainEntityOfPage: params.canonical,
  };
}

export function buildSiteOrganizationJsonLd(site: SiteMetadataDocument): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(site),
    name: site.companyName || site.siteTitle || 'Geul',
    url: site.canonicalOrigin,
    ...(site.logoUrl && { logo: site.logoUrl }),
    ...(site.socialLinks.length > 0 && { sameAs: site.socialLinks }),
  };
}

export function buildSiteWebSiteJsonLd(site: SiteMetadataDocument): JsonLdValue {
  const description = normalizeDescription(site.siteDescription);

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(site),
    url: site.canonicalOrigin,
    name: site.siteTitle || 'Geul',
    ...(description && { description }),
    publisher: { '@id': organizationId(site) },
  };
}

export function buildHomeJsonLd(home: HomeMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: home.site.canonicalOrigin,
    routePath: home.routePath,
  });
  const description = normalizeDescription(
    resolveLocalizedMetadataSummary(home.localizationInfo, home.summary, home.site.siteDescription),
  );

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': webpageId(canonical),
      ...baseCreativeWorkFields({
        canonical,
        id: webpageId(canonical),
        site: home.site,
        title: home.title,
        description,
        publishedAt: home.publishedAt,
        updatedAt: home.updatedAt,
      }),
    },
  ];
}

export function buildStaticWebPageJsonLd(params: {
  site: SiteMetadataDocument;
  routePath: string;
  title: string;
  description?: string | null;
}): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: params.site.canonicalOrigin,
    routePath: params.routePath,
  });
  const description = normalizeDescription(params.description);

  const webpage: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': webpageId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: webpageId(canonical),
      site: params.site,
      title: params.title,
      description,
    }),
  };

  const breadcrumb =
    params.routePath === '/'
      ? null
      : buildBreadcrumbJsonLd([
          { name: params.site.siteTitle || 'Home', url: params.site.canonicalOrigin },
          { name: params.title, url: canonical },
        ]);

  return breadcrumb ? [webpage, breadcrumb] : [webpage];
}

export function buildProgramEventJsonLd(params: {
  site: SiteMetadataDocument;
  routePath: string;
  title: string;
  summary?: string | null;
  posterUrl?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  locationMode: 'map_place' | 'online' | 'hybrid' | 'tba';
  locationPlace?: { name: string; lat: number; lng: number } | null;
  ticketUrl?: string | null;
  streamUrl?: string | null;
  externalUrl?: string | null;
  participants?: string[];
  updatedAt?: Date | null;
}): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: params.site.canonicalOrigin,
    routePath: params.routePath,
  });
  const description = normalizeDescription(params.summary);
  const image = buildImageValue(params.posterUrl);
  const attendanceMode =
    params.locationMode === 'online'
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : params.locationMode === 'hybrid'
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode';
  const location =
    params.locationMode === 'online'
      ? {
          '@type': 'VirtualLocation',
          url: params.streamUrl || params.externalUrl || canonical,
        }
      : params.locationPlace
        ? {
            '@type': 'Place',
            name: params.locationPlace.name,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: params.locationPlace.lat,
              longitude: params.locationPlace.lng,
            },
          }
        : undefined;

  const event: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': eventId(canonical),
    url: canonical,
    name: params.title,
    description,
    image,
    startDate: params.startsAt?.toISOString(),
    endDate: params.endsAt?.toISOString(),
    eventAttendanceMode: attendanceMode,
    eventStatus: 'https://schema.org/EventScheduled',
    location,
    organizer: { '@id': organizationId(params.site) },
    performer:
      params.participants && params.participants.length > 0
        ? params.participants.map((name) => ({ '@type': 'Person', name }))
        : undefined,
    offers: params.ticketUrl
      ? {
          '@type': 'Offer',
          url: params.ticketUrl,
          availability: 'https://schema.org/InStock',
        }
      : undefined,
    dateModified: params.updatedAt?.toISOString(),
    isPartOf: { '@id': websiteId(params.site) },
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: params.site.siteTitle || 'Home', url: params.site.canonicalOrigin },
    { name: params.title, url: canonical },
  ]);

  return breadcrumb ? [event, breadcrumb] : [event];
}

export function buildProgramEventSeriesJsonLd(params: {
  site: SiteMetadataDocument;
  routePath: string;
  title: string;
  summary?: string | null;
  posterUrl?: string | null;
}): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: params.site.canonicalOrigin,
    routePath: params.routePath,
  });
  const series: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'EventSeries',
    '@id': eventSeriesId(canonical),
    url: canonical,
    name: params.title,
    description: normalizeDescription(params.summary),
    image: buildImageValue(params.posterUrl),
    organizer: { '@id': organizationId(params.site) },
    isPartOf: { '@id': websiteId(params.site) },
    mainEntityOfPage: canonical,
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: params.site.siteTitle || 'Home', url: params.site.canonicalOrigin },
    { name: params.title, url: canonical },
  ]);

  return breadcrumb ? [series, breadcrumb] : [series];
}

export function buildPostJsonLd(post: PostMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: post.site.canonicalOrigin,
    routePath: post.routePath,
  });
  const description = normalizeDescription(post.summary);
  const image = buildImageValue(post.featuredImageUrl);

  const article: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': articleId(canonical),
    headline: post.title,
    ...baseCreativeWorkFields({
      canonical,
      id: articleId(canonical),
      site: post.site,
      title: post.title,
      description,
      image,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
    }),
    ...(post.authors.length > 0 && {
      author: post.authors.map((author) => ({
        '@type': 'Person',
        name: author.name,
      })),
    }),
    ...(post.categories.length > 0 && {
      articleSection: post.categories.map((category) => category.name),
    }),
    ...(post.tags.length > 0 && {
      keywords: post.tags.map((tag) => tag.name).join(', '),
    }),
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: post.site.siteTitle || 'Home', url: post.site.canonicalOrigin },
    { name: post.title, url: canonical },
  ]);

  return breadcrumb ? [article, breadcrumb] : [article];
}

export function buildPageJsonLd(page: PageMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: page.site.canonicalOrigin,
    routePath: page.routePath,
  });
  const description = normalizeDescription(page.summary);
  const image = buildImageValue(page.featuredImageUrl);

  const webpage: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': webpageId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: webpageId(canonical),
      site: page.site,
      title: page.title,
      description,
      image,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
    }),
  };

  const breadcrumb =
    page.routePath === '/'
      ? null
      : buildBreadcrumbJsonLd([
          { name: page.site.siteTitle || 'Home', url: page.site.canonicalOrigin },
          { name: page.title, url: canonical },
        ]);

  return breadcrumb ? [webpage, breadcrumb] : [webpage];
}

export function buildWorkJsonLd(work: WorkMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: work.site.canonicalOrigin,
    routePath: work.routePath,
  });
  const description = normalizeDescription(work.summary);
  const image = buildImageValue(work.featuredImageUrl);

  const creativeWork: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': creativeWorkId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: creativeWorkId(canonical),
      site: work.site,
      title: work.title,
      description,
      image,
      publishedAt: work.publishedAt,
      updatedAt: work.updatedAt,
    }),
    ...(work.credits.length > 0 && {
      creator: work.credits
        .map((credit) => credit.artist?.name ?? credit.member?.name ?? credit.name)
        .filter((name): name is string => Boolean(name))
        .map((name) => ({
          '@type': 'Person',
          name,
        })),
    }),
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: work.site.siteTitle || 'Home', url: work.site.canonicalOrigin },
    { name: work.title, url: canonical },
  ]);

  return breadcrumb ? [creativeWork, breadcrumb] : [creativeWork];
}

export function buildArtistJsonLd(artist: ArtistMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: artist.site.canonicalOrigin,
    routePath: artist.routePath,
  });
  const description = normalizeDescription(artist.bio);
  const image = buildImageValue(artist.imageUrl);

  const entity: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': artist.isGroup ? 'MusicGroup' : 'Person',
    '@id': artistId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: artistId(canonical),
      site: artist.site,
      title: artist.name,
      description,
      image,
      publishedAt: artist.publishedAt,
      updatedAt: artist.updatedAt,
    }),
    ...(artist.socialLinks.length > 0 && { sameAs: artist.socialLinks }),
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: artist.site.siteTitle || 'Home', url: artist.site.canonicalOrigin },
    { name: artist.name, url: canonical },
  ]);

  return breadcrumb ? [entity, breadcrumb] : [entity];
}

export function buildLabelJsonLd(label: LabelMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: label.site.canonicalOrigin,
    routePath: label.routePath,
  });
  const description = normalizeDescription(label.description);
  const image = buildImageValue(label.imageUrl);

  const entity: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationEntityId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: organizationEntityId(canonical),
      site: label.site,
      title: label.name,
      description,
      image,
      publishedAt: label.publishedAt,
      updatedAt: label.updatedAt,
    }),
    ...(label.socialLinks.length > 0 && { sameAs: label.socialLinks }),
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: label.site.siteTitle || 'Home', url: label.site.canonicalOrigin },
    { name: label.name, url: canonical },
  ]);

  return breadcrumb ? [entity, breadcrumb] : [entity];
}

export function buildReleaseJsonLd(release: ReleaseMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: release.site.canonicalOrigin,
    routePath: release.routePath,
  });
  const description = normalizeDescription(release.description);
  const image = buildImageValue(release.artworkUrl);
  const title = release.title;

  const entity: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    '@id': albumId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: albumId(canonical),
      site: release.site,
      title,
      description,
      image,
      publishedAt: release.publishedAt,
    }),
    ...(release.releaseDate && { datePublished: release.releaseDate.toISOString() }),
    ...(release.artists.length > 0 && {
      byArtist: release.artists.map((artist) => ({
        '@type': 'MusicGroup',
        name: artist.name,
        url: joinUrl(release.site.canonicalOrigin, `/artists/${artist.slug || artist.id}`),
      })),
    }),
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: release.site.siteTitle || 'Home', url: release.site.canonicalOrigin },
    { name: release.title, url: canonical },
  ]);

  return breadcrumb ? [entity, breadcrumb] : [entity];
}

export function buildTaxonomyJsonLd(taxonomy: TaxonomyMetadataDocument): JsonLdValue[] {
  const canonical = resolveCanonicalUrl({
    canonicalOrigin: taxonomy.site.canonicalOrigin,
    routePath: taxonomy.routePath,
  });
  const description = normalizeDescription(
    taxonomy.description ?? `Browse posts ${taxonomy.taxonomy === 'category' ? 'in' : 'tagged with'} ${taxonomy.name}.`,
  );

  const page: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': collectionPageId(canonical),
    ...baseCreativeWorkFields({
      canonical,
      id: collectionPageId(canonical),
      site: taxonomy.site,
      title: taxonomy.name,
      description,
    }),
  };

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: taxonomy.site.siteTitle || 'Home', url: taxonomy.site.canonicalOrigin },
    { name: taxonomy.name, url: canonical },
  ]);

  return breadcrumb ? [page, breadcrumb] : [page];
}
