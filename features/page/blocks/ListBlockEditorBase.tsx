'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import { Select, NumberInput, SegmentedControl, Switch } from '@/components/core/Input';
import {
  COLUMN_OPTIONS,
  getAspectRatioOptions,
  getLayoutOptionsPostList,
  getSortOrderOptions,
  SLIDES_TO_SHOW_OPTIONS,
} from './constants';

interface ListBlockEditorBaseProps {
  editorType: string;
  limitLabel: string;
  layout: string;
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
  columnOptions?: ReadonlyArray<{ value: string; label: string }>;
  slidesToShowOptions?: ReadonlyArray<{ value: string; label: string }>;
  onUpdate: (key: string, value: string) => void;
}

export function ListBlockEditorBase({
  editorType,
  limitLabel,
  layout,
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
  columnOptions = COLUMN_OPTIONS,
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
    <Box data-page-block-editor={editorType}>
      {filters ? (
        <>
          <Stack gap="sm">
            <Text size="xs" c="dimmed" fw={500}>
              {tPageEditor('blockEditor.sections.filters')}
            </Text>
            {filters}
          </Stack>
          <Box h="sm" />
        </>
      ) : null}

      <Stack gap="sm">
        <Text size="xs" c="dimmed" fw={500}>
          {tPageEditor('blockEditor.sections.layout')}
        </Text>

        <SegmentedControl
          data={[...layoutOptions]}
          value={layout}
          onChange={(value) => onUpdate('layout', value)}
          size="xs"
          fullWidth
        />

        {layout === 'grid' || layout === 'cards' || layout === 'carousel' ? (
          <Select
            label={
              layout === 'carousel'
                ? tPageEditor('blockEditor.labels.slidesToShow')
                : tPageEditor('blockEditor.labels.columns')
            }
            data={[...(layout === 'carousel' ? slidesToShowOptions : columnOptions)]}
            value={columns}
            onChange={(value) => onUpdate('columns', value || defaultColumns)}
            size="xs"
          />
        ) : null}

        {layout === 'carousel' ? (
          <>
            <Switch
              label={tPageEditor('blockEditor.labels.infiniteLoop')}
              checked={carouselLoop === 'true'}
              onChange={(event) => onUpdate('carouselLoop', event.currentTarget.checked ? 'true' : 'false')}
              size="sm"
            />
            <Switch
              label={tPageEditor('blockEditor.labels.showIndicators')}
              checked={carouselIndicators === 'true'}
              onChange={(event) => onUpdate('carouselIndicators', event.currentTarget.checked ? 'true' : 'false')}
              size="sm"
            />
          </>
        ) : null}
      </Stack>

      {hasDisplaySection ? (
        <>
          <Divider my="sm" />
          <Stack gap="sm">
            <Text size="xs" c="dimmed" fw={500}>
              {tPageEditor('blockEditor.sections.displayOptions')}
            </Text>

            {showImage !== undefined ? (
              <Switch
                label={showImageLabel ?? tPageEditor('blockEditor.labels.showImage')}
                checked={showImage === 'true'}
                onChange={(event) => onUpdate('showImage', event.currentTarget.checked ? 'true' : 'false')}
                size="sm"
              />
            ) : null}

            {showImage === 'true' && imageAspectRatio !== undefined ? (
              <Select
                label={tPageEditor('blockEditor.labels.imageAspectRatio')}
                data={[...aspectRatioOptions]}
                value={imageAspectRatio}
                onChange={(value) => onUpdate('imageAspectRatio', value || '16:9')}
                size="xs"
              />
            ) : null}

            {extraDisplayOptions}
          </Stack>
        </>
      ) : null}

      <Divider my="sm" />

      <Stack gap="sm">
        <Text size="xs" c="dimmed" fw={500}>
          {hasSortingSection ? tPageEditor('blockEditor.sections.sorting') : 'Data'}
        </Text>

        {sortByOptions && sortBy ? (
          <Group grow>
            <Select
              label={tPageEditor('blockEditor.labels.sortBy')}
              data={[...sortByOptions]}
              value={sortBy}
              onChange={(value) => onUpdate('sortBy', value || sortBy)}
              size="xs"
            />
            {sortOrder ? (
              <Select
                label={tCommonLabels('order')}
                data={[...sortOrderOptions]}
                value={sortOrder}
                onChange={(value) => onUpdate('sortOrder', value || sortOrder)}
                size="xs"
              />
            ) : null}
          </Group>
        ) : null}

        {showPagination !== undefined ? (
          <Switch
            label={tPageEditor('blockEditor.labels.showPagination')}
            checked={showPagination === 'true'}
            onChange={(event) => onUpdate('showPagination', event.currentTarget.checked ? 'true' : 'false')}
            size="sm"
          />
        ) : null}

        <NumberInput
          label={limitLabel}
          value={Number.parseInt(limit || defaultLimit, 10)}
          onChange={(value) => onUpdate('limit', String(value || Number.parseInt(defaultLimit, 10)))}
          min={1}
          max={maxLimit}
          size="xs"
        />
      </Stack>
    </Box>
  );
}
