import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@mantine/core';
import { ContentLayoutView } from '@/features/document-layout';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { HwpEditorTool } from '@/features/tools/hwp/HwpEditorTool';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

const routePath = '/tools/hwp';

export async function generateMetadata(): Promise<Metadata> {
  const [t, site] = await Promise.all([getTranslations('tools.hwp'), getSiteMetadataDocument()]);

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    title: t('metadataTitle'),
    summary: t('metadataDescription'),
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function HwpEditorPage() {
  const [t, site] = await Promise.all([getTranslations('tools.hwp'), getSiteMetadataDocument()]);

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath,
          title: t('metadataTitle'),
          description: t('metadataDescription'),
        })}
      />
      <ContentLayoutView layout={{ contentHeight: 'viewport', pageChrome: 'flow', footer: 'flow' }}>
        <Container size="100%" w="100%" px={0} py="xl" data-hwp-editor-page>
          <HwpEditorTool />
        </Container>
      </ContentLayoutView>
    </>
  );
}
