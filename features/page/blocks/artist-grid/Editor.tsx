'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { MultiSelect, Switch } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import { ListBlockEditorBase } from '../ListBlockEditorBase';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { ArtistListProps } from './schema';
import { ArtistListView } from './View';

interface ArtistListSettingsFormProps {
  props: Partial<ArtistListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function ArtistListSettingsForm({ props, updateProps }: ArtistListSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const { data: labels } = useQuery({
    queryKey: ['labels'],
    queryFn: () => listLabelsForSelector(),
  });

  const layout = props.layout || 'grid';
  const labelIds = props.labelIds || '';
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

  const labelOptions =
    labels?.map((l) => ({
      value: l.id,
      label: l.name,
    })) || [];
  const sortByOptions = [
    { value: 'name', label: tCommonLabels('name') },
    {
      value: 'published_at',
      label: tPageEditor('blockEditor.options.sortBy.publishedDate'),
    },
  ] as const;

  return (
    <ListBlockEditorBase
      editorType="artist-list"
      limitLabel={tPageEditor('blockEditor.labels.maxArtists')}
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
      filters={
        <MultiSelect
          label={tCommonEntities('labels')}
          placeholder={tPageEditor('blockEditor.placeholders.allLabels')}
          data={labelOptions}
          value={labelIds ? labelIds.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('labelIds', values.join(','))}
          size="xs"
          clearable
          searchable
        />
      }
      extraDisplayOptions={
        <Switch
          label={tPageEditor('blockEditor.labels.showSocialLinks')}
          checked={showMeta === 'true'}
          onChange={(event) => updateProp('showMeta', event.currentTarget.checked ? 'true' : 'false')}
          size="sm"
        />
      }
      onUpdate={updateProp}
    />
  );
}

export function ArtistListSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<ArtistListProps>) {
  return <ArtistListSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function ArtistListEditor({ sectionId, props }: BlockEditorProps<ArtistListProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <ArtistListSettingsForm props={props} updateProps={updateProps} />;
}

export function ArtistListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<ArtistListProps>) {
  return <ArtistListView sectionId={sectionId} props={{ ...props }} />;
}
