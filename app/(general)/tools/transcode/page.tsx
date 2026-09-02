import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@mantine/core';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { AudioTranscodeTool } from '@/features/tools/transcode/AudioTranscodeTool';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

const routePath = '/tools/transcode';

export async function generateMetadata(): Promise<Metadata> {
  const [t, site] = await Promise.all([getTranslations('tools.transcode'), getSiteMetadataDocument()]);
  const title = t('metadataTitle');
  const description = t('metadataDescription');

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    title,
    summary: description,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function AudioTranscodePage() {
  const [t, site] = await Promise.all([getTranslations('tools.transcode'), getSiteMetadataDocument()]);
  const title = t('metadataTitle');
  const description = t('metadataDescription');

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath,
          title,
          description,
        })}
      />
      <Container size="lg" w="100%" px={0} py="xl" data-audio-transcode-page>
        <AudioTranscodeTool />
      </Container>
    </>
  );
}
