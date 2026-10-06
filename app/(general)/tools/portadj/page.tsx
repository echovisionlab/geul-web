import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@mantine/core';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PortaDJTool } from '@/features/tools/portadj/PortaDJTool';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

const routePath = '/tools/portadj';

export async function generateMetadata(): Promise<Metadata> {
  const [t, site] = await Promise.all([getTranslations('tools.portadj'), getSiteMetadataDocument()]);

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    title: t('metadataTitle'),
    summary: t('metadataDescription'),
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function PortaDJPage() {
  const [t, site] = await Promise.all([getTranslations('tools.portadj'), getSiteMetadataDocument()]);

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
      <Container size="lg" w="100%" px={0} py="xl" data-portadj-page>
        <PortaDJTool />
      </Container>
    </>
  );
}
