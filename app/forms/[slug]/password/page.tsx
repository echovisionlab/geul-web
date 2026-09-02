import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { FormPasswordContent } from '@/features/form/FormPasswordContent';
import { getFormMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { resolveLocalizedOgFallbacks } from '@/lib/translation/metadata';
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
  const t = await getTranslations('formPasswordPage.metadata');
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const form = await getFormMetadataDocument(slug, { requestedLocale });

  if (!form) {
    return generatePageRouteFallbackMetadata(['forms', slug, 'password'], query);
  }
  const ogFallbacks = resolveLocalizedOgFallbacks(form.localizationInfo, {
    featuredImageUrl: form.featuredImageUrl,
    siteOgImageUrl: form.site.siteOgImageUrl,
  });

  return withNoIndex(
    buildFormOgMetadata({
      canonicalOrigin: form.site.canonicalOrigin,
      routePath: form.routePath,
      title: form.title,
      description: t('description'),
      ogImageUrl: form.ogImageUrl,
      ...ogFallbacks,
      siteName: form.site.siteTitle || undefined,
    }),
  );
}

export default async function FormPasswordPage({ params, searchParams }: Props) {
  const [{ slug }, query, uiLocale] = await Promise.all([params, searchParams, getUserLocale()]);
  const share = Array.isArray(query.share) ? query.share[0] : query.share;
  if (share) {
    await connection();
  }
  const nextValue = Array.isArray(query.next) ? query.next[0] : query.next;
  const nextTarget = nextValue === 'dashboard' ? 'dashboard' : 'form';
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  if (!(await getFormMetadataDocument(slug, { requestedLocale }))) {
    return renderPageRouteFallback(['forms', slug, 'password'], query);
  }
  return <FormPasswordContent slug={slug} shareToken={share} next={nextTarget} requestedLocale={requestedLocale} />;
}
