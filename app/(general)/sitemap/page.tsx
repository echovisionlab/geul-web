import type { Metadata } from 'next';
import Link from 'next/link';
import { IconArticle, IconHome } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sitemapPage');
  const site = await getSiteMetadataDocument();
  const title = t('metadata.title');
  const description = t('metadata.description', { siteName: site.siteTitle || 'Site' });

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/sitemap',
    title,
    summary: description,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

interface SitemapSection {
  title: string;
  icon: React.ReactNode;
  items: { href: string; label: string }[];
}

export default async function SitemapPage() {
  const [t, tCommonEntities, tCommonLabels] = await Promise.all([
    getTranslations('sitemapPage'),
    getTranslations('common.entities'),
    getTranslations('common.labels'),
  ]);
  const site = await getSiteMetadataDocument();
  const title = t('metadata.title');
  const description = t('metadata.description', { siteName: site.siteTitle || 'Site' });
  const sections: SitemapSection[] = [
    {
      title: t('sections.main'),
      icon: <IconHome size={20} />,
      items: [
        { href: '/', label: t('items.home') },
        { href: '/privacy', label: tCommonEntities('privacy') },
        { href: '/terms', label: tCommonEntities('terms') },
      ],
    },
    {
      title: tCommonLabels('content'),
      icon: <IconArticle size={20} />,
      items: [
        { href: '/blog', label: t('items.blog') },
        { href: '/works', label: tCommonEntities('works') },
        { href: '/artists', label: tCommonEntities('artists') },
      ],
    },
  ];

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath: '/sitemap',
          title,
          description,
        })}
      />
      <Stack gap="md">
        <Stack gap="xs">
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {t('metadata.title')}
          </Title>
          <Text c="dimmed">{t('description')}</Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {sections.map((section) => (
            <Paper key={section.title} p="lg" withBorder>
              <Group gap="xs" mb="md">
                {section.icon}
                <Title order={3} size="h4">
                  {section.title}
                </Title>
              </Group>
              <Stack gap="xs">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      fontSize: 'var(--mantine-font-size-sm)',
                      color: 'var(--mantine-color-anchor)',
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </>
  );
}
