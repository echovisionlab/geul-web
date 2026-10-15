'use client';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { MultiSelect, Select } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import {
  listProgramEventSeriesOptionsBrowser,
  listProgramEventTypeOptionsBrowser,
} from '@/lib/queries/program-event-browser';
import { ListBlockEditorBase } from '../ListBlockEditorBase';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { ProgramEventListProps } from './schema';
import { ProgramEventListView } from './View';

interface ProgramEventListSettingsFormProps {
  readOnly?: boolean;
  props: Partial<ProgramEventListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function ProgramEventListSettingsForm({ props, updateProps, readOnly = false }: ProgramEventListSettingsFormProps) {
  const locale = useLocale();
  const tPageEditor = useTranslations('pageEditor');

  const layout = props.layout || 'grid';
  const columns = props.columns || '3';
  const limit = props.limit || '6';
  const sortBy = props.sortBy || 'starts_at';
  const sortOrder = props.sortOrder || 'asc';
  const showPagination = props.showPagination || 'false';
  const showImage = props.showImage || 'true';
  const imageAspectRatio = props.imageAspectRatio || '16:9';
  const carouselLoop = props.carouselLoop || 'true';
  const carouselIndicators = props.carouselIndicators || 'true';
  const typeIds = props.typeIds || '';
  const seriesId = props.seriesId || '';
  const timeWindow = props.timeWindow || 'all';

  const eventTypesQuery = useQuery({
    queryKey: ['program-events', 'types', locale],
    queryFn: () => listProgramEventTypeOptionsBrowser(locale),
  });
  const { data: eventTypes } = eventTypesQuery;
  const eventSeriesQuery = useQuery({
    queryKey: ['program-events', 'series', locale],
    queryFn: () => listProgramEventSeriesOptionsBrowser(locale),
  });
  const { data: eventSeries } = eventSeriesQuery;

  const typeOptions = eventTypes?.map((type) => ({ value: type.id, label: type.name })) ?? [];
  const seriesOptions = eventSeries?.map((series) => ({ value: series.id, label: series.title })) ?? [];
  const sortByOptions = [
    { value: 'starts_at', label: tPageEditor('blockEditor.options.sortBy.startDate') },
    { value: 'ends_at', label: tPageEditor('blockEditor.options.sortBy.endDate') },
    {
      value: 'published_at',
      label: tPageEditor('blockEditor.options.sortBy.publishedDate'),
    },
    { value: 'updated_at', label: tPageEditor('blockEditor.options.sortBy.updatedDate') },
    { value: 'title', label: tPageEditor('blockEditor.options.sortBy.title') },
  ] as const;
  const timeWindowOptions = [
    { value: 'upcoming', label: tPageEditor('blockEditor.options.timeWindow.upcoming') },
    { value: 'current', label: tPageEditor('blockEditor.options.timeWindow.current') },
    { value: 'past', label: tPageEditor('blockEditor.options.timeWindow.past') },
    { value: 'all', label: tPageEditor('blockEditor.options.timeWindow.all') },
  ];

  const updateProp = useCallback(
    (key: keyof ProgramEventListProps, value: string) => {
      if (readOnly) {
        return;
      }
      updateProps({ [key]: value });
    },
    [readOnly, updateProps],
  );

  return (
    <>
      <QueryErrorAlert queries={[eventTypesQuery, eventSeriesQuery]} />
      <ListBlockEditorBase
        readOnly={readOnly}
        editorType="program-event-list"
        limitLabel={tPageEditor('blockEditor.labels.numberOfProgramEvents')}
        layout={layout}
        itemSize={props.itemSize}
        columns={columns}
        limit={limit}
        maxLimit={24}
        defaultColumns="3"
        defaultLimit="6"
        sortBy={sortBy}
        sortByOptions={sortByOptions}
        sortOrder={sortOrder}
        showPagination={showPagination}
        showImage={showImage}
        imageAspectRatio={imageAspectRatio}
        carouselLoop={carouselLoop}
        carouselIndicators={carouselIndicators}
        filters={
          <>
            <MultiSelect
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.programEventTypes')}
              placeholder={tPageEditor('blockEditor.placeholders.allTypes')}
              data={typeOptions}
              value={typeIds ? typeIds.split(',').filter(Boolean) : []}
              onChange={(values) => updateProp('typeIds', values.join(','))}
              clearable
              searchable
            />
            <Select
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.programEventSeries')}
              placeholder={tPageEditor('blockEditor.placeholders.allSeries')}
              data={seriesOptions}
              value={seriesId || null}
              onChange={(value) => updateProp('seriesId', value || '')}
              clearable
              searchable
            />
            <Select
              disabled={readOnly}
              label={tPageEditor('blockEditor.labels.timeWindow')}
              data={timeWindowOptions}
              value={timeWindow}
              onChange={(value) =>
                updateProp('timeWindow', (value as ProgramEventListProps['timeWindow'] | null) || 'all')
              }
            />
          </>
        }
        onUpdate={(key, value) => updateProp(key as keyof ProgramEventListProps, value)}
      />
    </>
  );
}

export function ProgramEventListSettingsEditor({
  props,
  updateSharedProps,
  allowSharedEdits,
}: BlockSettingsEditorProps<ProgramEventListProps>) {
  return (
    <ProgramEventListSettingsForm props={props} updateProps={updateSharedProps} readOnly={allowSharedEdits === false} />
  );
}

export function ProgramEventListEditor({ sectionId, props }: BlockEditorProps<ProgramEventListProps>) {
  const { updateSection, editable, allowStructuralEdits } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      if (!editable || !allowStructuralEdits) {
        return;
      }
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection, editable, allowStructuralEdits],
  );

  return (
    <ProgramEventListSettingsForm
      props={props}
      updateProps={updateProps}
      readOnly={!editable || !allowStructuralEdits}
    />
  );
}

export function ProgramEventListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<ProgramEventListProps>) {
  return <ProgramEventListView sectionId={sectionId} props={{ ...props }} />;
}
