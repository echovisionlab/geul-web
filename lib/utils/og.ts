import { joinUrl } from '@/lib/utils/url';

interface EntityOgMetadataInput {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  summary?: string | null;
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
  openGraphType: 'article' | 'website' | 'profile' | 'music.album';
  publishedAt?: Date | null;
  authors?: string[];
  includeOgImageDimensions?: boolean;
}

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text for OG description (max 160 characters recommended)
 */
export function truncateForDescription(text: string | null, maxLength = 160): string {
  if (!text) {
    return '';
  }

  // Strip HTML tags and remove extra whitespace and newlines
  const cleaned = collapseWhitespace(stripHtmlTags(text));

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Find last space before maxLength to avoid cutting words
  const truncated = cleaned.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return `${truncated.substring(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}

function normalizeMetadataTitle(title: string): string {
  return collapseWhitespace(title);
}

function normalizeMetadataDescription(description?: string | null): string | undefined {
  const normalized = truncateForDescription(description ?? null);
  return normalized || undefined;
}

function resolveEntityOgImageUrl(params: {
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
}): string | undefined {
  const generatedImage = params.ogImageUrl?.trim();
  if (generatedImage) {
    return generatedImage;
  }

  const featuredImage = params.featuredImageUrl?.trim();
  if (featuredImage) {
    return featuredImage;
  }

  const siteImage = params.siteOgImageUrl?.trim();
  if (siteImage) {
    return siteImage;
  }

  return undefined;
}

function buildEntityOgMetadata(params: EntityOgMetadataInput) {
  const title = normalizeMetadataTitle(params.title);
  const description = normalizeMetadataDescription(params.summary ?? null);
  const canonical = joinUrl(params.canonicalOrigin, params.routePath);
  const ogImage = resolveEntityOgImageUrl({
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.featuredImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
  });

  return {
    title,
    ...(description && { description }),
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      ...(description && { description }),
      type: params.openGraphType,
      url: canonical,
      ...(ogImage && {
        images: [
          params.includeOgImageDimensions === false ? { url: ogImage } : { url: ogImage, width: 1200, height: 630 },
        ],
      }),
      ...(params.siteName && { siteName: params.siteName }),
      ...(params.publishedAt && { publishedTime: params.publishedAt.toISOString() }),
      ...(params.authors && params.authors.length > 0 && { authors: params.authors }),
    },
    twitter: {
      card: ogImage ? ('summary_large_image' as const) : ('summary' as const),
      title,
      ...(description && { description }),
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

/**
 * Build complete OpenGraph metadata for a post
 */
export function buildPostOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  summary?: string | null;
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  publishedAt?: Date | null;
  authors?: string[];
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.summary,
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.featuredImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'article',
    publishedAt: params.publishedAt,
    authors: params.authors,
  });
}

/**
 * Build complete OpenGraph metadata for a page
 */
export function buildPageOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  summary?: string | null;
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.summary,
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.featuredImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
  });
}

/** Build localized Post Series metadata with its global Featured Image fallback. */
export function buildSeriesOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  description?: string | null;
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.description,
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.featuredImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
  });
}

/**
 * Build complete OpenGraph metadata for a work
 */
export function buildWorkOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  summary?: string | null;
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  publishedAt?: Date | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.summary,
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.featuredImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
    publishedAt: params.publishedAt,
  });
}

/** Build Program Event Series metadata from its global poster asset. */
export function buildProgramEventSeriesOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  summary?: string | null;
  posterUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.summary,
    featuredImageUrl: params.posterUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
    includeOgImageDimensions: false,
  });
}

/** Build Program Event metadata from its primary poster asset. */
export function buildProgramEventOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  summary?: string | null;
  posterUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.summary,
    featuredImageUrl: params.posterUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
    includeOgImageDimensions: false,
  });
}

/**
 * Build OpenGraph metadata for static pages (privacy, terms, auth pages, etc.)
 */
export function buildStaticOgMetadata(params: {
  baseUrl: string;
  title: string;
  description: string;
  path: string;
  siteName?: string;
  imageUrl?: string;
}) {
  const { baseUrl, title, description, path, siteName, imageUrl } = params;

  const url = joinUrl(baseUrl, path);
  const ogImage = imageUrl?.trim() || undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: 'website' as const,
      url,
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630 }] }),
      ...(siteName && { siteName }),
    },
    twitter: {
      card: ogImage ? ('summary_large_image' as const) : ('summary' as const),
      title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

/**
 * Build OpenGraph metadata for public forms
 */
export function buildFormOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  description?: string | null;
  ogImageUrl?: string | null;
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.description ?? params.title,
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.featuredImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
  });
}

/**
 * Build OpenGraph metadata for user profiles
 */
export function buildUserOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.name,
    summary: params.bio ?? `${params.name}${params.siteName ? ` on ${params.siteName}` : ''}`,
    featuredImageUrl: params.avatarUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'profile',
  });
}

/**
 * Build OpenGraph metadata for artist profiles
 */
export function buildArtistOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  name: string;
  bio?: string | null;
  ogImageUrl?: string | null;
  imageUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.name,
    summary: params.bio ?? `${params.name}${params.siteName ? ` on ${params.siteName}` : ''}`,
    ogImageUrl: params.ogImageUrl,
    featuredImageUrl: params.imageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'profile',
  });
}

/**
 * Build OpenGraph metadata for record labels
 */
export function buildLabelOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  name: string;
  description?: string | null;
  ogImageUrl?: string | null;
  siteOgImageUrl?: string | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.name,
    summary: params.description ?? `${params.name} - Record Label${params.siteName ? ` on ${params.siteName}` : ''}`,
    ogImageUrl: params.ogImageUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'website',
  });
}

/**
 * Build OpenGraph metadata for public releases
 */
export function buildReleaseOgMetadata(params: {
  canonicalOrigin: string;
  routePath: string;
  title: string;
  description: string;
  artworkUrl?: string | null;
  siteOgImageUrl?: string | null;
  publishedAt?: Date | null;
  siteName?: string | null;
}) {
  return buildEntityOgMetadata({
    canonicalOrigin: params.canonicalOrigin,
    routePath: params.routePath,
    title: params.title,
    summary: params.description,
    featuredImageUrl: params.artworkUrl,
    siteOgImageUrl: params.siteOgImageUrl,
    siteName: params.siteName,
    openGraphType: 'music.album',
    publishedAt: params.publishedAt,
    includeOgImageDimensions: false,
  });
}
