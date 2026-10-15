import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageLoader } from '@/features/site/PageLoader';
import { PublicFormView } from '@/features/form/PublicFormView';
import type { FormEditRouteContent } from '@/features/form/FormEditRoute';
import { LazyFormEditRoute } from '@/features/form/LazyFormEditRoute';
import { checkFormAccessibilityBySlugAction } from '@/lib/actions/form';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { createContext } from '@/lib/context';
import { getFormMetadataDocument } from '@/lib/queries/metadata';
import { getFormEditorInitialFields, getFormSettingsMeta, getFormSubmissionWithSchema } from '@/lib/queries/form';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildFormOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { buildSearchSuffix } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query, uiLocale] = await Promise.all([params, searchParams, getUserLocale()]);
  if (query.edit === 'true') {
    return withNoIndex({ title: 'Edit form' });
  }
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const form = await getFormMetadataDocument(slug, { requestedLocale });
  if (!form) {
    return generatePageRouteFallbackMetadata(['forms', slug], query);
  }

  const ogFallbacks = resolveLocalizedOgFallbacks(form.localizationInfo, {
    featuredImageUrl: form.featuredImageUrl,
    siteOgImageUrl: form.site.siteOgImageUrl,
  });
  const metadata = buildFormOgMetadata({
    canonicalOrigin: form.site.canonicalOrigin,
    routePath: form.routePath,
    title: form.title,
    ogImageUrl: form.ogImageUrl,
    ...ogFallbacks,
    siteName: form.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: form.site.canonicalOrigin,
    routePath: form.routePath,
    query,
    localizationInfo: form.localizationInfo,
  });
  return withNoIndex(applyContentMetadataSeo(metadata, seo));
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const [{ slug }, query, uiLocale, ctx] = await Promise.all([params, searchParams, getUserLocale(), createContext()]);
  if (query.edit === 'true') {
    const session = await getSession();
    if (session?.user) {
      const settings = await getFormSettingsMeta(slug);
      if (!settings) {
        return renderPageRouteFallback(['forms', slug], query);
      }
    }
    return renderFormEditRoute(slug, query);
  }
  const share = Array.isArray(query.share) ? query.share[0] : query.share;
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);

  if (!(await getFormMetadataDocument(slug, { requestedLocale }))) {
    return renderPageRouteFallback(['forms', slug], query);
  }

  const accessData = await checkFormAccessibilityBySlugAction(slug, share, requestedLocale);
  const form = accessData.accessible ? (accessData.form ?? null) : null;

  return (
    <Suspense fallback={<PageLoader />}>
      <PublicFormView
        slug={slug}
        form={form}
        accessData={accessData}
        requestedLocale={requestedLocale}
        viewerCountryCode={ctx.countryCode}
      />
    </Suspense>
  );
}

async function renderFormEditRoute(slugOrId: string, query: Record<string, string | string[] | undefined>) {
  const requestedPath = `/forms/${encodeURIComponent(slugOrId)}${buildSearchSuffix(query)}`;
  const session = await getSession();
  if (!session?.user) {
    redirect(buildLoginRedirectHref(requestedPath));
  }
  if (session.user.role !== 'admin') {
    notFound();
  }

  const form = await getFormSettingsMeta(slugOrId);
  if (!form) {
    notFound();
  }
  if (slugOrId !== form.id) {
    redirect(`/forms/${encodeURIComponent(form.id)}${buildSearchSuffix(query)}`);
  }
  const initialFields = await getFormEditorInitialFields(form.id);
  if (!initialFields) {
    notFound();
  }

  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab = ['builder', 'settings', 'translations', 'submissions'].includes(rawTab ?? '') ? rawTab! : 'builder';
  const editBaseHref = `/forms/${encodeURIComponent(form.id)}?edit=true&tab=submissions`;
  let content: FormEditRouteContent;

  if (tab === 'settings') {
    const baseUrl = await getBaseUrl();
    content = {
      tab: 'settings',
      settings: {
        baseUrl,
        initialSlug: form.slug,
        initialIsPublic: form.isPublic,
        initialOpensAt: form.opensAt,
        initialClosesAt: form.closesAt,
        initialMaxSubmissions: form.maxSubmissions,
        initialRequireAuth: form.requireAuth,
        initialAllowedRoles: form.allowedRoles,
        initialAllowDuplicateSubmission: form.allowDuplicateSubmission,
        initialHasPassword: form.hasPassword,
        initialOgImageUrl: form.ogImageUrl,
        initialFeaturedImageUrl: form.featuredImageUrl,
      },
    };
  } else if (tab === 'translations') {
    content = { tab: 'translations' };
  } else if (tab === 'submissions') {
    const submissionId = Array.isArray(query.submission) ? query.submission[0] : query.submission;
    if (submissionId) {
      const data = await getFormSubmissionWithSchema(submissionId);
      if (!data || data.submission.formId !== form.id) {
        notFound();
      }
      content = {
        tab: 'submission',
        submission: data.submission,
        formSchema: data.formSchema,
        returnHref: editBaseHref,
      };
    } else {
      content = { tab: 'submissions', editBaseHref };
    }
  } else {
    content = { tab: 'builder' };
  }

  // The collaborative editor loads on demand so the public form page does not ship Yjs.
  return (
    <LazyFormEditRoute formId={form.id} initialFields={initialFields} initialStatus={form.status} content={content} />
  );
}
