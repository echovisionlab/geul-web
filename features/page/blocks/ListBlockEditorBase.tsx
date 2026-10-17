'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { CollectionSize } from '@/components/core/Collection/collection-contract';
import { CollectionSizeControl } from './CollectionSizeControl';

import { Select, NumberInput, SegmentedControl, Switch } from '@/components/core/Input';
import {
  getAspectRatioOptions,
  getLayoutOptionsPostList,
  getSortOrderOptions,
  SLIDES_TO_SHOW_OPTIONS,
} from './constants';

interface ListBlockEditorBaseProps {
  editorType: string;
  readOnly?: boolean;
  limitLabel: string;
  layout: string;
  itemSize?: CollectionSize;
  columns: string;
  limit: string;
  maxLimit: number;
  defaultColumns: string;
  defaultLimit: string;
  sortBy?: string;
  sortByOptions?: ReadonlyArray<{ value: string; label: string }>;
  sortOrder?: string;
  showPagination?: string;
  showImage?: string;
  showImageLabel?: string;
  imageAspectRatio?: string;
  carouselLoop: string;
  carouselIndicators: string;
  filters?: ReactNode;
  extraDisplayOptions?: ReactNode;
  slidesToShowOptions?: ReadonlyArray<{ value: string; label: string }>;
  onUpdate: (key: string, value: string) => void;
}

export function ListBlockEditorBase({
  editorType,
  readOnly = false,
  limitLabel,
  layout,
  itemSize,
  columns,
  limit,
  maxLimit,
  defaultColumns,
  defaultLimit,
  sortBy,
  sortByOptions,
  sortOrder,
  showPagination,
  showImage,
  showImageLabel,
  imageAspectRatio,
  carouselLoop,
  carouselIndicators,
  filters,
  extraDisplayOptions,
  slidesToShowOptions = SLIDES_TO_SHOW_OPTIONS,
  onUpdate,
}: ListBlockEditorBaseProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');
  const layoutOptions = getLayoutOptionsPostList({
    grid: tPageEditor('blockEditor.options.layout.grid'),
    list: tPageEditor('blockEditor.options.layout.list'),
    cards: tPageEditor('blockEditor.options.layout.cards'),
    minimal: tPageEditor('blockEditor.options.layout.minimal'),
    carousel: tPageEditor('blockEditor.options.layout.carousel'),
  });
  const aspectRatioOptions = getAspectRatioOptions({
    auto: tPageEditor('blockEditor.options.aspectRatio.auto'),
  });
  const sortOrderOptions = getSortOrderOptions({
    newest: tPageEditor('blockEditor.options.sortOrder.newest'),
    oldest: tPageEditor('blockEditor.options.sortOrder.oldest'),
  });
  const hasDisplaySection = showImage !== undefined || extraDisplayOptions;
  const hasSortingSection = sortByOptions || sortOrder || showPagination !== undefined;

  return (
    <DsLayoutStack gap="lg" data-page-block-editor={editorType}>
      {filters ? (
        <DsLayoutStack gap="md">
          <DsText size="xs" tone="secondary" weight="medium">
            {tPageEditor('blockEditor.sections.filters')}
          </DsText>
          {filters}
        </DsLayoutStack>
      ) : null}

      <DsLayoutStack gap="md">
        <DsText size="xs" tone="secondary" weight="medium">
          {hasSortingSection
            ? tPageEditor('blockEditor.sections.sorting')
            : tPageEditor('blockEditor.sections.content')}
        </DsText>

        {sortByOptions && sortBy ? (
          <DsLayoutInline grow>
            <Select
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.sortBy')}
              data={[...sortByOptions]}
              value={sortBy}
              onChange={(value) => !readOnly && onUpdate('sortBy', value || sortBy)}
            />
            {sortOrder ? (
              <Select
                disabled={readOnly}
                label={tCommonLabels('order')}
                data={[...sortOrderOptions]}
                value={sortOrder}
                onChange={(value) => !readOnly && onUpdate('sortOrder', value || sortOrder)}
              />
            ) : null}
          </DsLayoutInline>
        ) : null}

        {showPagination !== undefined ? (
          <Switch
            disabled={readOnly}
            label={tPageEditor('blockEditor.labels.showPagination')}
            checked={showPagination === 'true'}
            onChange={(event) =>
              !readOnly && onUpdate('showPagination', event.currentTarget.checked ? 'true' : 'false')
            }
          />
        ) : null}

        <NumberInput
          disabled={readOnly}
          label={limitLabel}
          value={Number.parseInt(limit || defaultLimit, 10)}
          onChange={(value) => !readOnly && onUpdate('limit', String(value || Number.parseInt(defaultLimit, 10)))}
          min={1}
          max={maxLimit}
        />
      </DsLayoutStack>

      <DsLayoutStack gap="md">
        <DsText size="xs" tone="secondary" weight="medium">
          {tPageEditor('blockEditor.sections.layout')}
        </DsText>

        <SegmentedControl
          disabled={readOnly}
          data={[...layoutOptions]}
          value={layout}
          onChange={(value) => !readOnly && onUpdate('layout', value)}
          fullWidth
        />

        <CollectionSizeControl
          disabled={readOnly}
          value={itemSize}
          onChange={(value) => !readOnly && onUpdate('itemSize', value)}
        />

        {/* Grid and card columns follow the item size; only carousels take an authored count. */}
        {layout === 'carousel' ? (
          <Select
            disabled={readOnly}
            label={tPageEditor('blockEditor.labels.slidesToShow')}
            data={[...slidesToShowOptions]}
            value={columns}
            onChange={(value) => !readOnly && onUpdate('columns', value || defaultColumns)}
          />
        ) : null}

        {layout === 'carousel' ? (
          <>
            <Switch
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.infiniteLoop')}
              checked={carouselLoop === 'true'}
              onChange={(event) =>
                !readOnly && onUpdate('carouselLoop', event.currentTarget.checked ? 'true' : 'false')
              }
            />
            <Switch
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.showIndicators')}
              checked={carouselIndicators === 'true'}
              onChange={(event) =>
                !readOnly && onUpdate('carouselIndicators', event.currentTarget.checked ? 'true' : 'false')
              }
            />
          </>
        ) : null}
      </DsLayoutStack>

      {hasDisplaySection ? (
        <DsLayoutStack gap="md">
          <DsText size="xs" tone="secondary" weight="medium">
            {tPageEditor('blockEditor.sections.displayOptions')}
          </DsText>

          {showImage !== undefined ? (
            <Switch
              disabled={readOnly}
              label={showImageLabel ?? tPageEditor('blockEditor.labels.showImage')}
              checked={showImage === 'true'}
              onChange={(event) => !readOnly && onUpdate('showImage', event.currentTarget.checked ? 'true' : 'false')}
            />
          ) : null}

          {showImage === 'true' && imageAspectRatio !== undefined ? (
            <Select
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.imageAspectRatio')}
              data={[...aspectRatioOptions]}
              value={imageAspectRatio}
              onChange={(value) => !readOnly && onUpdate('imageAspectRatio', value || '16:9')}
            />
          ) : null}

          {extraDisplayOptions}
        </DsLayoutStack>
      ) : null}
    </DsLayoutStack>
  );
}
