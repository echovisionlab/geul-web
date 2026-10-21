'use client';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback } from 'react';
import { IconFilter, IconMapPin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import { MultiSelect, Select, NumberInput, Switch } from '@/components/core/Input';
import { listMapThemesAction } from '@/lib/actions/map-theme';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT, normalizeMapZoomBounds } from '@/lib/types/map/model';
import { WORK_TYPES } from '@/lib/types/work/model';
import {
  getAspectRatioOptions,
  getMapColorSchemeOptions,
  getMapLabelModeOptions,
  getMapPrimaryLabelOptions,
  getSortByOptions,
  getSortOrderOptions,
} from '../constants';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { WorkMapProps } from './schema';
import { WorkMapView } from './View';
import { DisplaySizeControl } from '../DisplaySizeControl';

interface WorkMapSettingsFormProps {
  props: Partial<WorkMapProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function WorkMapSettingsForm({ props, updateProps }: WorkMapSettingsFormProps) {
  const t = useTranslations('pageEditor.mapEditor');
  const tCommonLabels = useTranslations('common.labels');
  const tMapControls = useTranslations('mapControls');
  const tPageEditor = useTranslations('pageEditor');
  const tWorks = useTranslations('works');

  const workTypes = props.workTypes || '';
  const featuredOnly = props.featuredOnly === 'true';
  const sortBy = props.sortBy || 'published_at';
  const sortOrder = props.sortOrder || 'desc';
  const aspectRatio = props.aspectRatio || '16:9';
  const displaySize = props.displaySize || '100';
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
  const primaryLabelOptions = getMapPrimaryLabelOptions({
    content: tPageEditor('blockEditor.labels.workTitle'),
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

  const { data: themes } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: () => listMapThemesAction(),
  });

  const workTypeOptions = WORK_TYPES.map((type) => ({
    value: type,
    label: tWorks(`types.${type}`),
  }));
  const themeOptions =
    themes?.themes.map((theme) => ({
      value: theme.id,
      label: theme.name,
    })) || [];

  const updateProp = useCallback(
    (key: keyof WorkMapProps, value: string) => {
      updateProps({ [key]: value });
    },
    [updateProps],
  );

  const updateZoomBounds = useCallback(
    (nextBounds: Partial<{ minZoom: number; maxZoom: number }>) => {
      const bounds = normalizeMapZoomBounds({
        minZoom: nextBounds.minZoom ?? minZoom,
        maxZoom: nextBounds.maxZoom ?? maxZoom,
      });

      updateProps({
        minZoom: String(bounds.minZoom),
        maxZoom: String(bounds.maxZoom),
      });
    },
    [maxZoom, minZoom, props, updateProps],
  );

  return (
    <DsLayoutStack gap="lg" data-page-block-editor="work-map">
      <DsLayoutInset blockEnd="md">
        <DsLayoutInline gap="xs">
          <IconMapPin size={18} />
          <DsText size="sm" weight="medium">
            {tPageEditor('sectionTypes.workMap')}
          </DsText>
          <LabelBadge size="sm">{t('viewportQueryBadge')}</LabelBadge>
          <LabelBadge size="sm" tone={featuredOnly ? 'accent' : 'neutral'}>
            {featuredOnly ? t('featuredOnlyBadge') : t('allMappedWorksBadge')}
          </LabelBadge>
        </DsLayoutInline>
      </DsLayoutInset>

      <DsLayoutStack gap="md">
        <DsLayoutInline gap="xs">
          <IconFilter size={14} />
          <DsText size="xs" tone="secondary" weight="medium">
            {t('filtersSection')}
          </DsText>
        </DsLayoutInline>

        <MultiSelect
          label={t('workTypesLabel')}
          placeholder={t('workTypesPlaceholder')}
          data={workTypeOptions}
          value={workTypes ? workTypes.split(',') : []}
          onChange={(values) => updateProp('workTypes', values.join(','))}
          clearable
        />

        <Switch
          label={t('featuredOnlyLabel')}
          checked={featuredOnly}
          onChange={(event) => updateProp('featuredOnly', event.currentTarget.checked ? 'true' : 'false')}
        />

        <DsText size="xs" tone="secondary">
          {t('onlyWorksWithAssignedLocation')}
        </DsText>
      </DsLayoutStack>

      <DsLayoutStack gap="md">
        <DsText size="xs" tone="secondary" weight="medium">
          {t('querySection')}
        </DsText>

        <DsLayoutInline grow>
          <Select
            label={t('sortByLabel')}
            data={[...sortByOptions]}
            value={sortBy}
            onChange={(value) => updateProp('sortBy', value || 'published_at')}
          />
          <Select
            label={tCommonLabels('order')}
            data={[...sortOrderOptions]}
            value={sortOrder}
            onChange={(value) => updateProp('sortOrder', value || 'desc')}
          />
        </DsLayoutInline>
      </DsLayoutStack>

      <DsLayoutStack gap="md">
        <DsText size="xs" tone="secondary" weight="medium">
          {t('mapSection')}
        </DsText>

        <Select
          label={t('primaryLabelLabel')}
          description={t('primaryLabelDescription')}
          data={[...primaryLabelOptions]}
          value={primaryLabel}
          onChange={(value) => updateProp('primaryLabel', value || 'content_title')}
        />

        <Select
          label={t('aspectRatioLabel')}
          data={aspectRatioOptions.filter((option) => option.value !== 'auto')}
          value={aspectRatio}
          onChange={(value) => updateProp('aspectRatio', value || '16:9')}
        />

        <DsLayoutInline grow>
          <DisplaySizeControl
            label={t('displaySizeLabel')}
            value={displaySize}
            onChange={(next) => updateProp('displaySize', next)}
          />
          <Select
            label={tMapControls('fields.colorScheme')}
            data={[...colorSchemeOptions]}
            value={preferredScheme}
            onChange={(value) => updateProp('preferredScheme', value || 'auto')}
          />
        </DsLayoutInline>

        <DsLayoutInline grow>
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
          />
        </DsLayoutInline>

        <DsLayoutInline grow>
          <Select
            label={tMapControls('fields.areaLabels')}
            data={[...labelModeOptions]}
            value={areaLabelsMode}
            onChange={(value) => updateProp('areaLabelsMode', value || 'inherit')}
          />
          <Select
            label={tMapControls('fields.poiLabels')}
            data={[...labelModeOptions]}
            value={poiLabelsMode}
            onChange={(value) => updateProp('poiLabelsMode', value || 'inherit')}
          />
        </DsLayoutInline>

        <Select
          label={tMapControls('fields.theme')}
          placeholder={t('defaultThemePlaceholder')}
          data={themeOptions}
          value={themeId || null}
          onChange={(value) => updateProp('themeId', value || '')}
          clearable
          searchable
        />
      </DsLayoutStack>
    </DsLayoutStack>
  );
}

export function WorkMapSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<WorkMapProps>) {
  return <WorkMapSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function WorkMapEditor({ sectionId, props }: BlockEditorProps<WorkMapProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <WorkMapSettingsForm props={props} updateProps={updateProps} />;
}

export function WorkMapCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<WorkMapProps>) {
  return <WorkMapView sectionId={sectionId} props={{ ...props }} />;
}
