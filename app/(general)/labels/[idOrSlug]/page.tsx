import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { getTranslations } from 'next-intl/server';
import { AdminLabelDetailClient } from '@/features/label/AdminLabelDetailClient';
import { createPublicShareLinkClient } from '@/lib/api/server-client';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getLabelForEdit, getLabelPublic } from '@/lib/queries/label';
import { getLabelMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { applyContentMetadataSeo, buildContentMetadataSeo } from '@/lib/translation/metadata';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildLabelOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { buildSearchSuffix } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import { LabelPublicContent } from './LabelPublicContent';
import { LabelShareViewClient } from './LabelShareViewClient';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function isEditRequest(query: Record<string, string | string[] | undefined>): boolean {
  const edit = query.edit;
  return (Array.isArray(edit) ? edit[0] : edit) === 'true';
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEditRequest(query)) {
    await connection();
    const [tActions, tEntities] = await Promise.all([
      getTranslations('common.actions'),
      getTranslations('common.entities'),
    ]);
    return withNoIndex({ title: `${tActions('edit')} ${tEntities('label')}` });
  }

  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  if (shareToken) {
    await connection();
    return withNoIndex({ referrer: 'no-referrer' });
  }
  const tCommonEntities = await getTranslations('common.entities');
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const label = await getLabelMetadataDocument(idOrSlug, { requestedLocale });
  if (!label) {
    return generatePageRouteFallbackMetadata(['labels', idOrSlug], query);
  }

  const metadata = buildLabelOgMetadata({
    canonicalOrigin: label.site.canonicalOrigin,
    routePath: label.routePath,
    name: label.name || tCommonEntities('label'),
    description: label.description,
    ogImageUrl: label.ogImageUrl,
    siteOgImageUrl: label.site.siteOgImageUrl,
    siteName: label.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: label.site.canonicalOrigin,
    routePath: label.routePath,
    query,
    localizationInfo: label.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);
  return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
}

export default async function LabelViewPage({ params, searchParams }: Props) {
  await connection();
  await getRequestHeaders();
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEditRequest(query)) {
    const editorPath = `/labels/${encodeURIComponent(idOrSlug)}${buildSearchSuffix(query)}`;
    const session = await getSession();
    if (!session?.user) {
      redirect(buildLoginRedirectHref(editorPath));
    }

    const label = await getLabelForEdit(idOrSlug);
    if (!label) {
      return renderPageRouteFallback(['labels', idOrSlug], query);
    }
    if (idOrSlug !== label.id) {
      redirect(`/labels/${encodeURIComponent(label.id)}${buildSearchSuffix(query)}`);
    }
    return (
      <AdminLabelDetailClient
        id={label.id}
        label={label}
        baseUrl={await getBaseUrl()}
        backHref={`/labels/${label.slug || label.id}`}
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
      validation.entityType !== ShareLinkEntityType.LABEL ||
      (!validation.valid && !validation.passwordRequired)
    ) {
      notFound();
    }
    if (validation.passwordRequired) {
      return (
        <LabelShareViewClient
          token={shareToken}
          idOrSlug={idOrSlug}
          requestedLocale={requestedLocale}
          uiLocale={uiLocale}
        />
      );
    }
  }

  const [label, labelMetadata, baseUrl] = await Promise.all([
    getLabelPublic(idOrSlug, shareToken, { requestedLocale }),
    shareToken ? Promise.resolve(null) : getLabelMetadataDocument(idOrSlug, { requestedLocale }),
    getBaseUrl(),
  ]);
  if (!label) {
    return renderPageRouteFallback(['labels', idOrSlug], query);
  }
  return (
    <LabelPublicContent
      label={label}
      labelMetadata={labelMetadata}
      baseUrl={baseUrl}
      query={query}
      requestedLocale={requestedLocale}
      uiLocale={uiLocale}
    />
  );
}
