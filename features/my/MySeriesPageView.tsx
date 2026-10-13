'use client';
import { SupportingText, Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import Link from '@/components/core/Navigation';
import { useTranslations } from 'next-intl';

import { StatusBadge, type StatusBadgeTone } from '@/components/core/Badge';
import { SectionCard } from '@/components/core/Section';
import type { listMySeries } from '@/lib/queries/series';

const STATUS_TONES: Record<string, StatusBadgeTone> = {
  draft: 'neutral',
  published: 'positive',
};

export function MySeriesPageView({ items }: { items: Awaited<ReturnType<typeof listMySeries>> }) {
  const t = useTranslations('series');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');

  return (
    <DsLayoutStack>
      <DsHeading level={1} scale={2}>
        {tCommonEntities('series')}
      </DsHeading>

      {items.length === 0 ? (
        <SupportingText tone="secondary">{t('empty')}</SupportingText>
      ) : (
        <DsLayoutStack gap="sm">
          {items.map((series) => (
            <Link key={series.id} href={`/my/series/${series.id}`} appearance="block">
              <SectionCard withBorder>
                <DsLayoutInline justify="between" align="start">
                  <DsLayoutStack gap="xxs">
                    <DsText size="sm" weight="strong">
                      {series.title}
                    </DsText>
                    {series.slug && (
                      <DsText size="xs" tone="secondary">
                        /{series.slug}
                      </DsText>
                    )}
                  </DsLayoutStack>
                  <StatusBadge tone={STATUS_TONES[series.status] ?? 'neutral'}>
                    {tCommon(`statuses.${series.status}`)}
                  </StatusBadge>
                </DsLayoutInline>
                <DsLayoutInset blockStart="sm">
                  <DsLayoutInline gap="md">
                    <DsText size="xs" tone="secondary">
                      {t('stats.posts', { count: series.postCount })}
                    </DsText>
                    <DsText size="xs" tone="secondary">
                      {t('stats.managers', { count: series.managerCount })}
                    </DsText>
                  </DsLayoutInline>
                </DsLayoutInset>
              </SectionCard>
            </Link>
          ))}
        </DsLayoutStack>
      )}
    </DsLayoutStack>
  );
}
