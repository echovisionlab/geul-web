import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { ReleaseEditor } from '@/features/release/ReleaseEditor/ReleaseEditor';
import { getReleaseMetadataDocument } from '@/lib/queries/metadata';
import { getReleaseAdminAction } from '@/lib/actions/release';
import { listTracksByReleaseAction } from '@/lib/actions/track';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getReleasePublic, resolveReleaseIdForEdit } from '@/lib/queries/release';
import { createPublicShareLinkClient } from '@/lib/api/server-client';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { applyContentMetadataSeo, buildContentMetadataSeo } from '@/lib/translation/metadata';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildReleaseOgMetadata, truncateForDescription } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { buildSearchSuffix } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';
import type { ReleaseType } from '@/lib/types/release/model';
import { joinUrl } from '@/lib/utils/url';
import { getBaseUrl } from '@/lib/utils/url.server';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import { ReleasePublicContent } from './ReleasePublicContent';
import { ReleaseShareViewClient } from './ReleaseShareViewClient';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function isEditRequest(query: Record<string, string | string[] | undefined>): boolean {
  const edit = query.edit;
  return (Array.isArray(edit) ? edit[0] : edit) === 'true';
}

function dedupeReleaseArtists<T extends { id: string; role?: string | null }>(artists: T[]): T[] {
  const seen = new Set<string>();
  return artists.filter((artist) => {
    const key = `${artist.id}:${artist.role ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEditRequest(query)) {
    await connection();
    const [tActions, tEntities] = await Promise.all([
      getTranslations('common.actions'),
      getTranslations('common.entities'),
    ]);
    return withNoIndex({ title: `${tActions('edit')} ${tEntities('release')}` });
  }

  const t = await getTranslations('releasePage');
  if (query.share) {
    await connection();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const release = await getReleaseMetadataDocument(idOrSlug, {
    requestedLocale,
  });

  if (!release) {
    return generatePageRouteFallbackMetadata(['releases', idOrSlug], query);
  }

  const releaseArtists = dedupeReleaseArtists(release.artists);
  const artistNames = releaseArtists.map((artist) => artist.name).join(', ');
  const description = truncateForDescription(
    release.description ||
      (artistNames
        ? t('metadata.fallbackDescriptionWithArtists', {
            title: release.title,
            artists: artistNames,
          })
        : t('metadata.fallbackDescription', { title: release.title })),
  );

  const metadata = buildReleaseOgMetadata({
    canonicalOrigin: release.site.canonicalOrigin,
    routePath: release.routePath,
    title: release.title,
    description,
    artworkUrl: release.artworkUrl,
    siteOgImageUrl: release.site.siteOgImageUrl,
    publishedAt: release.publishedAt,
    siteName: release.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: release.site.canonicalOrigin,
    routePath: release.routePath,
    query,
    localizationInfo: release.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);

  if (!query.share) {
    return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
  }

  return withNoIndex({
    ...localizedMetadata,
    alternates: {
      canonical: joinUrl(release.site.canonicalOrigin, release.routePath),
    },
  });
}

export default async function ReleaseViewPage({ params, searchParams }: Props) {
  await connection();
  await getRequestHeaders();
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);

  if (isEditRequest(query)) {
    const editorPath = `/releases/${encodeURIComponent(idOrSlug)}${buildSearchSuffix(query)}`;
    const session = await getSession();
    if (!session?.user) {
      redirect(buildLoginRedirectHref(editorPath));
    }
    if (session.user.role !== 'admin') {
      notFound();
    }

    const releaseId = await resolveReleaseIdForEdit(idOrSlug);
    if (!releaseId) {
      return renderPageRouteFallback(['releases', idOrSlug], query);
    }
    if (idOrSlug !== releaseId) {
      redirect(`/releases/${encodeURIComponent(releaseId)}${buildSearchSuffix(query)}`);
    }
    const [release, baseUrl, initialTracks] = await Promise.all([
      getReleaseAdminAction(releaseId),
      getBaseUrl(),
      listTracksByReleaseAction(releaseId),
    ]);
    if (!release) {
      notFound();
    }

    return (
      <ReleaseEditor
        releaseId={release.id}
        initialTitle={release.title}
        initialSlug={release.slug}
        initialType={release.type as ReleaseType}
        initialReleaseDate={release.releaseDate}
        initialArtworkUrl={release.artworkUrl}
        initialStatus={release.status}
        initialSpotifyUrl={release.spotifyUrl}
        initialAppleMusicUrl={release.appleMusicUrl}
        initialBandcampUrl={release.bandcampUrl}
        initialYoutubeMusicUrl={release.youtubeMusicUrl}
        initialCredits={[]}
        initialLabels={[]}
        initialCategories={[]}
        initialGenres={[]}
        initialStyles={[]}
        initialFormats={[]}
        initialTracks={initialTracks}
        baseUrl={baseUrl}
      />
    );
  }

  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  if (shareToken) {
    const validation = await createPublicShareLinkClient()
      .validate({ token: shareToken })
      .catch(() => null);
    if (
      !validation ||
      validation.entityType !== ShareLinkEntityType.RELEASE ||
      (!validation.valid && !validation.passwordRequired)
    ) {
      notFound();
    }
    if (validation.passwordRequired) {
      return (
        <ReleaseShareViewClient
          token={shareToken}
          idOrSlug={idOrSlug}
          requestedLocale={requestedLocale}
          uiLocale={uiLocale}
        />
      );
    }
  }

  const [release, releaseMetadata] = await Promise.all([
    getReleasePublic(idOrSlug, shareToken, {
      requestedLocale,
    }),
    shareToken
      ? Promise.resolve(null)
      : getReleaseMetadataDocument(idOrSlug, {
          requestedLocale,
        }),
  ]);

  if (!release) {
    return renderPageRouteFallback(['releases', idOrSlug], query);
  }

  return (
    <ReleasePublicContent
      release={release}
      releaseMetadata={releaseMetadata}
      query={query}
      requestedLocale={requestedLocale}
      uiLocale={uiLocale}
      shareToken={shareToken}
    />
  );
}
