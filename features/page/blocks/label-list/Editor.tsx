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
  readOnly?: boolean;
  props: Partial<LabelListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function LabelListSettingsForm({ props, updateProps, readOnly = false }: LabelListSettingsFormProps) {
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
      if (readOnly) {
        return;
      }
      updateProps({ [key]: value });
    },
    [readOnly, updateProps],
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
      readOnly={readOnly}
      editorType="label-list"
      limitLabel={tPageEditor('blockEditor.labels.maxLabels')}
      layout={layout}
      itemSize={props.itemSize}
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

export function LabelListSettingsEditor({
  props,
  updateSharedProps,
  allowSharedEdits,
}: BlockSettingsEditorProps<LabelListProps>) {
  return <LabelListSettingsForm props={props} updateProps={updateSharedProps} readOnly={allowSharedEdits === false} />;
}

export function LabelListEditor({ sectionId, props }: BlockEditorProps<LabelListProps>) {
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
    <LabelListSettingsForm props={props} updateProps={updateProps} readOnly={!editable || !allowStructuralEdits} />
  );
}

export function LabelListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<LabelListProps>) {
  return <LabelListView sectionId={sectionId} props={{ ...props }} />;
}
