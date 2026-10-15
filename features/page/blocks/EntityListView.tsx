'use client';

import type { ReactNode } from 'react';
import type { CollectionSize } from '@/components/core/Collection';

import { ListViewShell, type ListViewLayout, type ListViewShellItem } from './ListViewShell';

export interface EntityListItem extends ListViewShellItem {
  title: string;
}

interface EntityListViewProps<T extends EntityListItem> {
  items: T[];
  className: string;
  emptyLabel: string;
  layout: ListViewLayout;
  itemSize?: CollectionSize;
  columns: number;
  showImage: boolean;
  imageAspectRatio?: string;
  carouselLoop: boolean;
  carouselIndicators: boolean;
  emptyImageLabel?: string;
  gridCols?: {
    base: number;
    sm: number;
  };
  renderMeta?: (item: T) => ReactNode;
}

export function EntityListView<T extends EntityListItem>({
  items,
  className,
  emptyLabel,
  layout,
  itemSize,
  columns,
  showImage,
  imageAspectRatio = '16:9',
  carouselLoop,
  carouselIndicators,
  gridCols = { base: 1, sm: 2 },
  renderMeta,
}: EntityListViewProps<T>) {
  return (
    <ListViewShell
      items={items}
      className={className}
      emptyLabel={emptyLabel}
      layout={layout}
      itemSize={itemSize}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      gridCols={gridCols}
      renderListMeta={renderMeta}
      renderMinimalMeta={renderMeta}
      renderCardsMeta={renderMeta}
      renderGridMeta={renderMeta}
      renderCarouselCardMeta={renderMeta}
      renderHeroMeta={renderMeta}
    />
  );
}
