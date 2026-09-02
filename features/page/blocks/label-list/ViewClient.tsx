'use client';

import { useLocale } from 'next-intl';
import { Text } from '@mantine/core';
import { formatCountryDisplayName } from '@/lib/countries';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { LabelListProps } from './schema';

interface LabelListItem extends EntityListItem {
  countryCode: string | null;
}

interface LabelListViewClientProps {
  labels: LabelListItem[];
  parsedProps: LabelListProps;
}

export function LabelListViewClient({ labels, parsedProps: p }: LabelListViewClientProps) {
  const locale = useLocale();
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
      emptyLabel="No labels found"
      layout={layout}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (label) =>
              label.countryCode ? (
                <Text size="xs" c="dimmed">
                  {formatCountryDisplayName(label.countryCode, locale)}
                </Text>
              ) : null
          : undefined
      }
    />
  );
}
