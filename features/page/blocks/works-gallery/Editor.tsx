'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { MultiSelect, Switch } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { ListBlockEditorBase } from '../ListBlockEditorBase';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { getWorkTableEditorTypeOptions } from '../work-table/spec';
import type { WorkListProps } from './schema';
import { WorkListView } from './View';

interface WorkListSettingsFormProps {
  readOnly?: boolean;
  props: Partial<WorkListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function WorkListSettingsForm({ props, updateProps, readOnly = false }: WorkListSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tWorks = useTranslations('works');

  const workTypes = props.workTypes || '';
  const layout = props.layout || 'grid';
  const columns = props.columns || '3';
  const sortBy = props.sortBy || 'published_at';
  const sortOrder = props.sortOrder || 'desc';
  const limit = props.limit || '6';
  const showPagination = props.showPagination || 'false';
  const showImage = props.showImage || 'true';
  const showMeta = props.showMeta || 'true';
  const imageAspectRatio = props.imageAspectRatio || '16:9';
  const featuredOnly = props.featuredOnly || 'false';
  const carouselLoop = props.carouselLoop || 'true';
  const carouselIndicators = props.carouselIndicators || 'true';

  const updateProp = useCallback(
    (key: string, value: string) => {
      if (readOnly) {
        return;
      }
      updateProps({ [key]: value });
    },
    [readOnly, updateProps],
  );

  const typeOptions = getWorkTableEditorTypeOptions({
    typeOptionLabels: {
      music_project: tWorks('types.music_project'),
      portfolio: tWorks('types.portfolio'),
      article: tWorks('types.article'),
      contribution: tWorks('types.contribution'),
    },
  });

  const sortByOptions = [
    {
      value: 'published_at',
      label: tPageEditor('blockEditor.options.sortBy.publishedDate'),
    },
    { value: 'updated_at', label: tPageEditor('blockEditor.options.sortBy.updatedDate') },
    { value: 'title', label: tPageEditor('blockEditor.options.sortBy.title') },
  ] as const;

  return (
    <ListBlockEditorBase
      readOnly={readOnly}
      editorType="work-list"
      limitLabel={tPageEditor('blockEditor.labels.numberOfWorks')}
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
            label={tPageEditor('blockEditor.labels.workTypes')}
            placeholder={tPageEditor('blockEditor.placeholders.allTypes')}
            data={typeOptions}
            value={workTypes ? workTypes.split(',').filter(Boolean) : []}
            onChange={(values) => updateProp('workTypes', values.join(','))}
            searchable
            clearable
          />
          <Switch
            disabled={readOnly}
            label={tPageEditor('blockEditor.labels.featuredWorksOnly')}
            checked={featuredOnly === 'true'}
            onChange={(event) => updateProp('featuredOnly', event.currentTarget.checked ? 'true' : 'false')}
          />
        </>
      }
      extraDisplayOptions={
        <Switch
          disabled={readOnly}
          label={tPageEditor('blockEditor.labels.showMeta')}
          checked={showMeta === 'true'}
          onChange={(event) => updateProp('showMeta', event.currentTarget.checked ? 'true' : 'false')}
        />
      }
      onUpdate={updateProp}
    />
  );
}

export function WorkListSettingsEditor({
  props,
  updateSharedProps,
  allowSharedEdits,
}: BlockSettingsEditorProps<WorkListProps>) {
  return <WorkListSettingsForm props={props} updateProps={updateSharedProps} readOnly={allowSharedEdits === false} />;
}

export function WorkListEditor({ sectionId, props }: BlockEditorProps<WorkListProps>) {
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

  return <WorkListSettingsForm props={props} updateProps={updateProps} readOnly={!editable || !allowStructuralEdits} />;
}

export function WorkListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<WorkListProps>) {
  return <WorkListView sectionId={sectionId} props={{ ...props }} />;
}
