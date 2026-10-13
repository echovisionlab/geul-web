'use client';
import { getCollectionMetrics } from '@/components/core/Collection/collection-contract';

import { Text as DsText } from '@/components/core/Typography';
import { useLocale, useTranslations } from 'next-intl';

import { formatCountryDisplayName } from '@/lib/countries';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { LabelListProps } from './schema';

interface LabelListItem extends EntityListItem {
  countryCode: string | null;
}

export interface LabelListViewClientProps {
  labels: LabelListItem[];
  parsedProps: LabelListProps;
}

export function LabelListViewClient({ labels, parsedProps: p }: LabelListViewClientProps) {
  const locale = useLocale();
  const t = useTranslations();
  const metrics = getCollectionMetrics(p.itemSize);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showImage = p.showImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const imageAspectRatio = p.imageAspectRatio || '1:1';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <EntityListView
      items={labels}
      className="label-list-block"
      emptyLabel={t('common.messages.noLabelsFound')}
      layout={layout}
      itemSize={p.itemSize}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (label) =>
              label.countryCode ? (
                <DsText size={metrics.metaSize} tone="secondary">
                  {formatCountryDisplayName(label.countryCode, locale)}
                </DsText>
              ) : null
          : undefined
      }
    />
  );
}
