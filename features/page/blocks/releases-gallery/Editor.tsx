'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { MultiSelect, Select, Switch } from '@/components/core/Input';
import { listArtistsAction } from '@/lib/actions/artist';
import { listCategoriesAction } from '@/lib/actions/category';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import { ListBlockEditorBase } from '../ListBlockEditorBase';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { ReleaseListProps } from './schema';
import { ReleaseListView } from './View';

interface ReleaseListSettingsFormProps {
  props: Partial<ReleaseListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function ReleaseListSettingsForm({ props, updateProps }: ReleaseListSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tReleaseTypes = useTranslations('releasePage.types');
  const tCommonEntities = useTranslations('common.entities');
  const { data: artists } = useQuery({
    queryKey: ['artists', 'selector'],
    queryFn: () => listArtistsAction(),
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategoriesAction(),
  });
  const { data: labels } = useQuery({
    queryKey: ['labels', 'selector'],
    queryFn: () => listLabelsForSelector(),
  });

  const layout = props.layout || 'grid';
  const columns = props.columns || '4';
  const types = props.types || '';
  const categoryIds = props.categoryIds || '';
  const artistId = props.artistId || '';
  const labelId = props.labelId || '';
  const sortBy = props.sortBy || 'release_date';
  const sortOrder = props.sortOrder || 'desc';
  const limit = props.limit || '8';
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

  const typeOptions = [
    { value: 'album', label: tReleaseTypes('album') },
    { value: 'ep', label: tReleaseTypes('ep') },
    { value: 'single', label: tReleaseTypes('single') },
    { value: 'compilation', label: tReleaseTypes('compilation') },
  ] as const;

  const sortByOptions = [
    { value: 'release_date', label: 'Release date' },
    {
      value: 'published_at',
      label: tPageEditor('blockEditor.options.sortBy.publishedDate'),
    },
    { value: 'title', label: tPageEditor('blockEditor.options.sortBy.title') },
  ] as const;

  return (
    <ListBlockEditorBase
      editorType="release-list"
      limitLabel={tPageEditor('blockEditor.labels.numberOfReleases')}
      layout={layout}
      columns={columns}
      limit={limit}
      maxLimit={24}
      defaultColumns="4"
      defaultLimit="8"
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
            label={tPageEditor('blockEditor.labels.releaseTypes')}
            placeholder="All release types"
            data={typeOptions}
            value={types ? types.split(',').filter(Boolean) : []}
            onChange={(values) => updateProp('types', values.join(','))}
            size="xs"
            searchable
            clearable
          />
          <MultiSelect
            label={tCommonEntities('categories')}
            placeholder="All categories"
            data={
              categories?.map((category) => ({
                value: category.id,
                label: category.name,
              })) ?? []
            }
            value={categoryIds ? categoryIds.split(',').filter(Boolean) : []}
            onChange={(values) => updateProp('categoryIds', values.join(','))}
            size="xs"
            searchable
            clearable
          />
          <Select
            label={tCommonEntities('artists')}
            placeholder="All artists"
            data={
              artists?.map((artist) => ({
                value: artist.id,
                label: artist.name,
              })) ?? []
            }
            value={artistId || null}
            onChange={(value) => updateProp('artistId', value || '')}
            size="xs"
            searchable
            clearable
          />
          <Select
            label={tCommonEntities('labels')}
            placeholder={tPageEditor('blockEditor.placeholders.allLabels')}
            data={
              labels?.map((label) => ({
                value: label.id,
                label: label.name,
              })) ?? []
            }
            value={labelId || null}
            onChange={(value) => updateProp('labelId', value || '')}
            size="xs"
            searchable
            clearable
          />
        </>
      }
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

export function ReleaseListSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<ReleaseListProps>) {
  return <ReleaseListSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function ReleaseListEditor({ sectionId, props }: BlockEditorProps<ReleaseListProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <ReleaseListSettingsForm props={props} updateProps={updateProps} />;
}

export function ReleaseListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<ReleaseListProps>) {
  return <ReleaseListView sectionId={sectionId} props={{ ...props }} />;
}
