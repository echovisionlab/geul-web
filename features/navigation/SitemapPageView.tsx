'use client';
import { SupportingText, Heading as DsHeading } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { IconArticle, IconHome } from '@tabler/icons-react';
import { SectionCard as DsSectionCard } from '@/components/core/Section';
import {
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import Link from '@/components/core/Navigation';
interface SitemapSection {
  title: string;
  icon: ReactNode;
  items: { href: string; label: string }[];
}
export function SitemapPageView() {
  const t = useTranslations('sitemapPage');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const sections: SitemapSection[] = [
    {
      title: t('sections.main'),
      icon: <IconHome size={20} aria-hidden />,
      items: [
        { href: '/', label: t('items.home') },
        { href: '/privacy', label: tCommonEntities('privacy') },
        { href: '/terms', label: tCommonEntities('terms') },
      ],
    },
    {
      title: tCommonLabels('content'),
      icon: <IconArticle size={20} aria-hidden />,
      items: [
        { href: '/blog', label: t('items.blog') },
        { href: '/works', label: tCommonEntities('works') },
        { href: '/artists', label: tCommonEntities('artists') },
      ],
    },
  ];

  return (
    <DsLayoutStack gap="md">
      <DsLayoutStack gap="xs">
        <DsHeading level={1} scale={2}>
          {t('metadata.title')}
        </DsHeading>
        <SupportingText tone="secondary">{t('description')}</SupportingText>
      </DsLayoutStack>

      <DsLayoutGrid columns={{ base: 1, sm: 2 }} gap="lg">
        {sections.map((section) => (
          <DsSectionCard padding="lg" key={section.title}>
            <DsLayoutInset blockEnd="md">
              <DsLayoutInline gap="xs">
                {section.icon}
                <DsHeading level={2} scale={4}>
                  {section.title}
                </DsHeading>
              </DsLayoutInline>
            </DsLayoutInset>
            <DsLayoutStack gap="xs">
              {section.items.map((item) => (
                <Link key={item.href} href={item.href} size="sm">
                  {item.label}
                </Link>
              ))}
            </DsLayoutStack>
          </DsSectionCard>
        ))}
      </DsLayoutGrid>
    </DsLayoutStack>
  );
}
