'use client';

import { useCallback } from 'react';
import { IconFilter, IconMapPin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { MultiSelect, Select, NumberInput, Switch } from '@/components/core/Input';
import { listCategoriesAction } from '@/lib/actions/category';
import { listMapThemesAction } from '@/lib/actions/map-theme';
import { listTagsAction } from '@/lib/actions/tag';
import { listAuthorOptionsAction } from '@/lib/actions/user';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listSeriesSimple } from '@/lib/queries/series-browser';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT, normalizeMapZoomBounds } from '@/lib/types/map/model';
import {
  getAspectRatioOptions,
  getMapColorSchemeOptions,
  getMapLabelModeOptions,
  getMapPrimaryLabelOptions,
  getSortByOptions,
  getSortOrderOptions,
} from '../constants';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { PostMapProps } from './schema';
import { PostMapView } from './View';

interface PostMapSettingsFormProps {
  props: Partial<PostMapProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function PostMapSettingsForm({ props, updateProps }: PostMapSettingsFormProps) {
  const t = useTranslations('pageEditor.mapEditor');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tMapControls = useTranslations('mapControls');
  const tPageEditor = useTranslations('pageEditor');

  const requirePlace = props.requirePlace !== 'false';
  const sortBy = props.sortBy || 'published_at';
  const sortOrder = props.sortOrder || 'desc';
  const aspectRatio = props.aspectRatio || '16:9';
  const previewWidth = props.previewWidth || '100';
  const zoomBounds = normalizeMapZoomBounds({
    minZoom: Number.parseFloat(props.minZoom || ''),
    maxZoom: Number.parseFloat(props.maxZoom || ''),
  });
  const minZoom = zoomBounds.minZoom;
  const maxZoom = zoomBounds.maxZoom;
  const primaryLabel = props.primaryLabel || 'content_title';
  const preferredScheme = props.preferredScheme || 'auto';
  const themeId = props.themeId || '';
  const areaLabelsMode = props.areaLabelsMode || 'inherit';
  const poiLabelsMode = props.poiLabelsMode || 'inherit';
  const categoryIds = props.categoryIds || '';
  const seriesId = props.seriesId || '';
  const authorIds = props.authorIds || '';
  const tagIds = props.tagIds || '';
  const primaryLabelOptions = getMapPrimaryLabelOptions({
    content: tPageEditor('blockEditor.labels.postTitle'),
    placeName: tPageEditor('blockEditor.options.mapPrimaryLabel.placeName'),
  });
  const aspectRatioOptions = getAspectRatioOptions({
    auto: tPageEditor('blockEditor.options.aspectRatio.auto'),
  });
  const sortByOptions = getSortByOptions({
    published: tCommonLabels('published'),
    updated: tCommonLabels('updated'),
    title: tCommonLabels('title'),
  });
  const sortOrderOptions = getSortOrderOptions({
    newest: tPageEditor('blockEditor.options.sortOrder.newest'),
    oldest: tPageEditor('blockEditor.options.sortOrder.oldest'),
  });
  const colorSchemeOptions = getMapColorSchemeOptions({
    auto: tPageEditor('blockEditor.options.colorScheme.auto'),
    light: tPageEditor('blockEditor.options.colorScheme.light'),
    dark: tPageEditor('blockEditor.options.colorScheme.dark'),
  });
  const labelModeOptions = getMapLabelModeOptions({
    inherit: tPageEditor('blockEditor.options.labelMode.inherit'),
    show: tPageEditor('blockEditor.options.labelMode.show'),
    hide: tPageEditor('blockEditor.options.labelMode.hide'),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategoriesAction(),
  });
  const { data: seriesList } = useQuery({
    queryKey: ['series', 'simple'],
    queryFn: () => listSeriesSimple(),
  });
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsAction(),
  });
  const { data: authorsData } = useQuery({
    queryKey: ['authors', 50],
    queryFn: () => listAuthorOptionsAction(50),
  });
  const { data: themes } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: () => listMapThemesAction(),
  });

  const categoryOptions = categories?.map((category) => ({ value: category.id, label: category.name })) || [];
  const seriesOptions = seriesList?.map((series) => ({ value: series.id, label: series.title })) || [];
  const tagOptions = tags?.map((tag) => ({ value: tag.id, label: tag.name })) || [];
  const authorOptions =
    authorsData?.map((author: { id: string; name: string | null }) => ({
      value: author.id,
      label: author.name ?? tCommonStates('unknown'),
    })) || [];
  const themeOptions =
    themes?.themes.map((theme) => ({
      value: theme.id,
      label: theme.name,
    })) || [];

  const updateProp = useCallback(
    (key: keyof PostMapProps, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [props, updateProps],
  );

  const updateZoomBounds = useCallback(
    (nextBounds: Partial<{ minZoom: number; maxZoom: number }>) => {
      const bounds = normalizeMapZoomBounds({
        minZoom: nextBounds.minZoom ?? minZoom,
        maxZoom: nextBounds.maxZoom ?? maxZoom,
      });

      updateProps({
        ...props,
        minZoom: String(bounds.minZoom),
        maxZoom: String(bounds.maxZoom),
      });
    },
    [maxZoom, minZoom, props, updateProps],
  );

  return (
    <Box data-page-block-editor="post-map">
      <Group gap="xs" mb="md">
        <IconMapPin size={18} />
        <Text size="sm" fw={500}>
          {tPageEditor('sectionTypes.postMap')}
        </Text>
        <LabelBadge size="sm">{t('viewportQueryBadge')}</LabelBadge>
        <LabelBadge size="sm" tone={requirePlace ? 'accent' : 'neutral'}>
          {requirePlace ? t('withPlaceOnlyBadge') : t('allPostsBadge')}
        </LabelBadge>
      </Group>

      <Stack gap="sm">
        <Group gap="xs">
          <IconFilter size={14} />
          <Text size="xs" c="dimmed" fw={500}>
            {t('filtersSection')}
          </Text>
        </Group>

        <MultiSelect
          label={tCommonEntities('categories')}
          placeholder={t('allCategoriesPlaceholder')}
          data={categoryOptions}
          value={categoryIds ? categoryIds.split(',') : []}
          onChange={(values) => updateProp('categoryIds', values.join(','))}
          size="xs"
          clearable
          searchable
        />

        <Select
          label={tCommonEntities('series')}
          placeholder={t('allSeriesPlaceholder')}
          data={seriesOptions}
          value={seriesId || null}
          onChange={(value) => updateProp('seriesId', value || '')}
          size="xs"
          clearable
          searchable
        />

        <MultiSelect
          label={tCommonLabels('authors')}
          placeholder={t('allAuthorsPlaceholder')}
          data={authorOptions}
          value={authorIds ? authorIds.split(',') : []}
          onChange={(values) => updateProp('authorIds', values.join(','))}
          size="xs"
          clearable
          searchable
        />

        <MultiSelect
          label={tCommonEntities('tags')}
          placeholder={t('allTagsPlaceholder')}
          data={tagOptions}
          value={tagIds ? tagIds.split(',') : []}
          onChange={(values) => updateProp('tagIds', values.join(','))}
          size="xs"
          clearable
          searchable
        />

        <Switch
          label={t('onlyIncludePostsWithLocation')}
          checked={requirePlace}
          onChange={(event) => updateProp('requirePlace', event.currentTarget.checked ? 'true' : 'false')}
          size="sm"
        />
      </Stack>

      <Divider my="sm" />

      <Stack gap="sm">
        <Text size="xs" c="dimmed" fw={500}>
          {t('querySection')}
        </Text>

        <Group grow>
          <Select
            label={t('sortByLabel')}
            data={[...sortByOptions]}
            value={sortBy}
            onChange={(value) => updateProp('sortBy', value || 'published_at')}
            size="xs"
          />
          <Select
            label={tCommonLabels('order')}
            data={[...sortOrderOptions]}
            value={sortOrder}
            onChange={(value) => updateProp('sortOrder', value || 'desc')}
            size="xs"
          />
        </Group>
      </Stack>

      <Divider my="sm" />

      <Stack gap="sm">
        <Text size="xs" c="dimmed" fw={500}>
          {t('mapSection')}
        </Text>

        <Select
          label={t('primaryLabelLabel')}
          description={t('primaryLabelDescription')}
          data={[...primaryLabelOptions]}
          value={primaryLabel}
          onChange={(value) => updateProp('primaryLabel', value || 'content_title')}
          size="xs"
        />

        <Group grow>
          <Select
            label={t('aspectRatioLabel')}
            data={[...aspectRatioOptions]}
            value={aspectRatio}
            onChange={(value) => updateProp('aspectRatio', value || '16:9')}
            size="xs"
          />
        </Group>

        <Group grow>
          <NumberInput
            label={t('previewWidthLabel')}
            value={Number.parseInt(previewWidth, 10)}
            onChange={(value) => updateProp('previewWidth', String(value || 100))}
            min={10}
            max={100}
            size="xs"
          />
          <Select
            label={tMapControls('fields.colorScheme')}
            data={[...colorSchemeOptions]}
            value={preferredScheme}
            onChange={(value) => updateProp('preferredScheme', value || 'auto')}
            size="xs"
          />
        </Group>

        <Group grow>
          <NumberInput
            label={tMapControls('fields.minZoom')}
            value={minZoom}
            onChange={(value) => {
              if (typeof value !== 'number' || Number.isNaN(value)) {
                return;
              }
              updateZoomBounds({ minZoom: value });
            }}
            min={MAP_MIN_ZOOM_LIMIT}
            max={MAP_MAX_ZOOM_LIMIT}
            step={0.1}
            decimalScale={1}
            size="xs"
          />
          <NumberInput
            label={tMapControls('fields.maxZoom')}
            value={maxZoom}
            onChange={(value) => {
              if (typeof value !== 'number' || Number.isNaN(value)) {
                return;
              }
              updateZoomBounds({ maxZoom: value });
            }}
            min={MAP_MIN_ZOOM_LIMIT}
            max={MAP_MAX_ZOOM_LIMIT}
            step={0.1}
            decimalScale={1}
            size="xs"
          />
        </Group>

        <Group grow>
          <Select
            label={tMapControls('fields.areaLabels')}
            data={[...labelModeOptions]}
            value={areaLabelsMode}
            onChange={(value) => updateProp('areaLabelsMode', value || 'inherit')}
            size="xs"
          />
          <Select
            label={tMapControls('fields.poiLabels')}
            data={[...labelModeOptions]}
            value={poiLabelsMode}
            onChange={(value) => updateProp('poiLabelsMode', value || 'inherit')}
            size="xs"
          />
        </Group>

        <Select
          label={tMapControls('fields.theme')}
          placeholder={t('defaultThemePlaceholder')}
          data={themeOptions}
          value={themeId || null}
          onChange={(value) => updateProp('themeId', value || '')}
          size="xs"
          clearable
          searchable
        />
      </Stack>
    </Box>
  );
}

export function PostMapSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<PostMapProps>) {
  return <PostMapSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function PostMapEditor({ sectionId, props }: BlockEditorProps<PostMapProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <PostMapSettingsForm props={props} updateProps={updateProps} />;
}

export function PostMapCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<PostMapProps>) {
  return <PostMapView sectionId={sectionId} props={{ ...props }} />;
}
