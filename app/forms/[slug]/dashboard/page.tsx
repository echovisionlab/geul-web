import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { FormDashboardView } from '@/features/form/FormDashboardView';
import { getFormMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildFormOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query, uiLocale] = await Promise.all([params, searchParams, getUserLocale()]);
  if (query.share) {
    await connection();
  }
  const t = await getTranslations('formDashboardPage.metadata');
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const form = await getFormMetadataDocument(slug, { requestedLocale });

  if (!form) {
    return generatePageRouteFallbackMetadata(['forms', slug, 'dashboard'], query);
  }

  return withNoIndex(
    buildFormOgMetadata({
      canonicalOrigin: form.site.canonicalOrigin,
      routePath: form.routePath,
      title: t('title', { formTitle: form.title }),
      description: t('description'),
      ogImageUrl: form.ogImageUrl,
      featuredImageUrl: form.featuredImageUrl,
      siteOgImageUrl: form.site.siteOgImageUrl,
      siteName: form.site.siteTitle || undefined,
    }),
  );
}

export default async function FormDashboardPage({ params, searchParams }: Props) {
  const [{ slug }, query, uiLocale] = await Promise.all([params, searchParams, getUserLocale()]);
  const share = Array.isArray(query.share) ? query.share[0] : query.share;
  if (share) {
    await connection();
  }
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  if (!(await getFormMetadataDocument(slug, { requestedLocale }))) {
    return renderPageRouteFallback(['forms', slug, 'dashboard'], query);
  }
  return <FormDashboardView slug={slug} shareToken={share} requestedLocale={requestedLocale} />;
}
