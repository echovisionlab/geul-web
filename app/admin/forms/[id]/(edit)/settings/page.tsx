import { notFound } from 'next/navigation';
import { getFormSettingsMeta } from '@/lib/queries/form';
import { getBaseUrl } from '@/lib/utils/url.server';
import { FormSettingsContent } from '@/features/form/FormSettingsContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminFormSettingsPage({ params }: Props) {
  const { id: formId } = await params;
  const [baseUrl, form] = await Promise.all([getBaseUrl(), getFormSettingsMeta(formId)]);

  if (!form) {
    notFound();
  }

  return (
    <FormSettingsContent
      formId={formId}
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
}
