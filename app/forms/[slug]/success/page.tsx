import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Box, Container, Paper, Stack } from '@mantine/core';
import { SiteLogo } from '@/features/site/SiteLogo';
import { FormSubmissionSuccessState } from '@/features/form/FormSubmissionState';
import { getFormMetadataDocument } from '@/lib/queries/metadata';
import { buildFormOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations('formSuccessPage');
  const tCommonMessages = await getTranslations('common.messages');
  const { slug } = await params;
  const form = await getFormMetadataDocument(slug);

  if (!form) {
    return generatePageRouteFallbackMetadata(['forms', slug, 'success'], {});
  }

  return withNoIndex(
    buildFormOgMetadata({
      canonicalOrigin: form.site.canonicalOrigin,
      routePath: form.routePath,
      title: t('metadata.title', { formTitle: form.title }),
      description: tCommonMessages('formSubmittedSuccessfully'),
      ogImageUrl: form.ogImageUrl,
      featuredImageUrl: form.featuredImageUrl,
      siteOgImageUrl: form.site.siteOgImageUrl,
      siteName: form.site.siteTitle || undefined,
    }),
  );
}

export default async function FormSuccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getFormMetadataDocument(slug))) {
    return renderPageRouteFallback(['forms', slug, 'success'], {});
  }
  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Box ta="center">
            <SiteLogo height={24} />
          </Box>

          <Paper p="xl" withBorder w="100%" maw={500} mx="auto">
            <FormSubmissionSuccessState />
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
