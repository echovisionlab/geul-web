import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArtistDetailEditor } from '@/features/artist/ArtistEditor/ArtistDetailEditor';
import { getArtistAdminAction } from '@/lib/actions/artist';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getSettings } from '@/lib/queries/manifest';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';
import { buildStaticOgMetadata } from '@/lib/utils/og';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export async function generateArtistEditMetadata(idOrSlug: string): Promise<Metadata> {
  const [tTitle, tMeta] = await Promise.all([
    getTranslations('artistAdminDetail'),
    getTranslations('editorMetadata.artistEdit'),
  ]);
  const [settings, baseUrl] = await Promise.all([getSettings(), getBaseUrl()]);
  const siteName = settings.site_title || 'Site';

  return withNoIndex(
    buildStaticOgMetadata({
      baseUrl,
      title: tTitle('title'),
      description: tMeta('description', { siteName }),
      path: `/artists/${encodeURIComponent(idOrSlug)}?edit=true`,
      siteName,
    }),
  );
}

export async function renderArtistEditRoute(idOrSlug: string, query: SearchParamRecord) {
  const requestedPath = buildEntityEditHref(`/artists/${encodeURIComponent(idOrSlug)}`, query);
  const session = await getSession();
  if (!session?.user) {
    redirect(buildLoginRedirectHref(requestedPath));
  }

  const artist = await getArtistAdminAction(idOrSlug);
  if (!artist) {
    notFound();
  }

  if (idOrSlug !== artist.id) {
    redirect(buildEntityEditHref(`/artists/${encodeURIComponent(artist.id)}`, query));
  }

  const baseUrl = await getBaseUrl();
  return <ArtistDetailEditor id={artist.id} artist={artist} baseUrl={baseUrl} />;
}
