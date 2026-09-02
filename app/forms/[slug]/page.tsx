import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Divider, Stack, Title } from '@mantine/core';
import { PageLoader } from '@/features/site/PageLoader';
import { PublicFormView } from '@/features/form/PublicFormView';
import { FormEditor } from '@/features/form/FormEditor/FormEditor';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { checkFormAccessibilityBySlugAction } from '@/lib/actions/form';
import { AdminFormLayoutClient } from '@/features/form/AdminFormLayoutClient';
import AdminFormSubmissionsPage from '@/features/form/AdminFormSubmissionsPage';
import { FormSettingsContent } from '@/features/form/FormSettingsContent';
import { SubmissionDeleteButton } from '@/features/form/SubmissionDeleteButton';
import { SubmissionDetail } from '@/features/form/SubmissionDetail';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { createContext } from '@/lib/context';
import { FormEditorProvider } from '@/lib/contexts/FormEditorContext';
import { FormTranslationProvider } from '@/features/form/FormTranslationContext';
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
  let content: React.ReactNode;

  if (tab === 'settings') {
    const baseUrl = await getBaseUrl();
    content = (
      <FormSettingsContent
        formId={form.id}
        baseUrl={baseUrl}
        initialSlug={form.slug}
        initialIsPublic={form.isPublic}
        initialOpensAt={form.opensAt}
        initialClosesAt={form.closesAt}
        initialMaxSubmissions={form.maxSubmissions}
        initialRequireAuth={form.requireAuth}
        initialAllowedRoles={form.allowedRoles}
        initialAllowDuplicateSubmission={form.allowDuplicateSubmission}
        initialHasPassword={form.hasPassword}
        initialOgImageUrl={form.ogImageUrl}
        initialFeaturedImageUrl={form.featuredImageUrl}
      />
    );
  } else if (tab === 'translations') {
    content = <EntityTranslationsPanel entityType="form" entityId={form.id} collapsible={false} />;
  } else if (tab === 'submissions') {
    const submissionId = Array.isArray(query.submission) ? query.submission[0] : query.submission;
    if (submissionId) {
      const data = await getFormSubmissionWithSchema(submissionId);
      if (!data || data.submission.formId !== form.id) {
        notFound();
      }
      content = (
        <Stack gap="md">
          <Title order={3}>Metadata</Title>
          <SubmissionDetail
            submission={data.submission}
            formId={form.id}
            deleteButton={
              <SubmissionDeleteButton submissionId={data.submission.id} formId={form.id} returnHref={editBaseHref} />
            }
          />
          <Divider />
          <Title order={3}>Responses</Title>
          <SubmissionDetail.Responses data={data.submission.data} schema={data.formSchema} />
        </Stack>
      );
    } else {
      content = <AdminFormSubmissionsPage formId={form.id} editBaseHref={editBaseHref} />;
    }
  } else {
    content = <FormEditor />;
  }

  return (
    <FormEditorProvider formId={form.id} initialFields={initialFields}>
      <FormTranslationProvider>
        <AdminFormLayoutClient formId={form.id} initialStatus={form.status}>
          {content}
        </AdminFormLayoutClient>
      </FormTranslationProvider>
    </FormEditorProvider>
  );
}
