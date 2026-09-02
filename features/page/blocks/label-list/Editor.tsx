'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { Switch } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { ListBlockEditorBase } from '../ListBlockEditorBase';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { LabelListProps } from './schema';
import { LabelListView } from './View';

interface LabelListSettingsFormProps {
  props: Partial<LabelListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function LabelListSettingsForm({ props, updateProps }: LabelListSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');

  const layout = props.layout || 'grid';
  const sortBy = props.sortBy || 'name';
  const sortOrder = props.sortOrder || 'asc';
  const columns = props.columns || '3';
  const limit = props.limit || '12';
  const showPagination = props.showPagination || 'false';
  const showImage = props.showImage || 'true';
  const showMeta = props.showMeta || 'true';
  const imageAspectRatio = props.imageAspectRatio || '1:1';
  const carouselLoop = props.carouselLoop || 'true';
  const carouselIndicators = props.carouselIndicators || 'true';

  const updateProp = useCallback(
    (key: string, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [updateProps, props],
  );

  const sortByOptions = [
    { value: 'name', label: tCommonLabels('name') },
    {
      value: 'published_at',
      label: tPageEditor('blockEditor.options.sortBy.publishedDate'),
    },
  ] as const;

  return (
    <ListBlockEditorBase
      editorType="label-list"
      limitLabel="Max labels"
      layout={layout}
      columns={columns}
      limit={limit}
      maxLimit={24}
      defaultColumns="3"
      defaultLimit="12"
      sortBy={sortBy}
      sortByOptions={sortByOptions}
      sortOrder={sortOrder}
      showPagination={showPagination}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      extraDisplayOptions={
        <Switch
          label={tPageEditor('blockEditor.labels.showMeta')}
          checked={showMeta === 'true'}
          onChange={(event) => updateProp('showMeta', event.currentTarget.checked ? 'true' : 'false')}
          size="sm"
        />
      }
      onUpdate={updateProp}
    />
  );
}

export function LabelListSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<LabelListProps>) {
  return <LabelListSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function LabelListEditor({ sectionId, props }: BlockEditorProps<LabelListProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <LabelListSettingsForm props={props} updateProps={updateProps} />;
}

export function LabelListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<LabelListProps>) {
  return <LabelListView sectionId={sectionId} props={{ ...props }} />;
}
