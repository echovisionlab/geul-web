import { isConnectError } from '@/lib/api/connect-error';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Code } from '@connectrpc/connect';
import { getTranslations } from 'next-intl/server';
import { PrivacyEditor } from '@/features/policy/PrivacyEditor';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { getPrivacyVersion } from '@/lib/queries/privacy';
import { getSession } from '@/lib/utils/session.server';
import { PRIVACY_STATUS } from '@/lib/policy-status';
import { getAllSiteSettings } from '@/lib/queries/site-setting';
import { isEntityEditView } from '@/lib/utils/entity-edit-route';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { PrivacyHistoryDetailClient } from './PrivacyHistoryDetailClient';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const query = await searchParams;
  if (isEntityEditView(query)) {
    const t = await getTranslations('privacyHistoryDetail.metadata');
    return withNoIndex({ title: t('title') });
  }
  const t = await getTranslations('privacyHistoryDetail.metadata');
  const [{ id }, site] = await Promise.all([params, getSiteMetadataDocument()]);
  const title = t('title');
  const description = t('description', { siteName: site.siteTitle || 'Site' });

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: `/privacy/history/${id}`,
    title,
    summary: description,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function PrivacyHistoryDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    await connection();
    try {
      const [privacy, session] = await Promise.all([getPrivacyVersion(id), getSession()]);
      const canReadArchived = privacy?.status === PRIVACY_STATUS.ARCHIVED && session?.user?.role === 'author';
      if (!privacy || (!canReadArchived && session?.user?.role !== 'admin')) {
        notFound();
      }
      const siteSettings = session?.user?.role === 'admin' ? await getAllSiteSettings() : null;
      return (
        <PrivacyEditor initialPrivacy={privacy} siteSettings={siteSettings} canEdit={session?.user?.role === 'admin'} />
      );
    } catch (error) {
      if (
        isConnectError(error) &&
        (error.code === Code.Unauthenticated || error.code === Code.PermissionDenied || error.code === Code.NotFound)
      ) {
        notFound();
      }
      throw error;
    }
  }
  const t = await getTranslations('privacyHistoryDetail.metadata');
  const site = await getSiteMetadataDocument();
  const title = t('title');
  const description = t('description', { siteName: site.siteTitle || 'Site' });

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath: `/privacy/history/${id}`,
          title,
          description,
        })}
      />
      <PrivacyHistoryDetailClient id={id} />
    </>
  );
}
