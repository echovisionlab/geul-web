'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { MultiSelect, Select, Switch } from '@/components/core/Input';
import { listCategoriesAction } from '@/lib/actions/category';
import { listTagsAction } from '@/lib/actions/tag';
import { listAuthorOptionsAction } from '@/lib/actions/user';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listSeriesSimple } from '@/lib/queries/series-browser';
import { getSortByOptions, MAX_LIMIT_POSTS } from '../constants';
import { ListBlockEditorBase } from '../ListBlockEditorBase';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { PostListProps } from './schema';
import { PostListView } from './View';

interface PostListSettingsFormProps {
  props: Partial<PostListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function PostListSettingsForm({ props, updateProps }: PostListSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');

  const layout = props.layout || 'grid';
  const columns = props.columns || '3';
  const limit = props.limit || '6';
  const sortBy = props.sortBy || 'published_at';
  const sortOrder = props.sortOrder || 'desc';
  const showFeaturedImage = props.showFeaturedImage || 'true';
  const showMeta = props.showMeta || 'true';
  const showPagination = props.showPagination || 'false';
  const imageAspectRatio = props.imageAspectRatio || '16:9';
  const carouselLoop = props.carouselLoop || 'true';
  const carouselIndicators = props.carouselIndicators || 'true';
  const categoryIds = props.categoryIds || '';
  const seriesId = props.seriesId || '';
  const authorIds = props.authorIds || '';
  const tagIds = props.tagIds || '';

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

  const categoryOptions = categories?.map((category) => ({ value: category.id, label: category.name })) ?? [];
  const seriesOptions = seriesList?.map((series) => ({ value: series.id, label: series.title })) ?? [];
  const tagOptions = tags?.map((tag) => ({ value: tag.id, label: tag.name })) ?? [];
  const authorOptions =
    authorsData?.map((author: { id: string; name: string | null }) => ({
      value: author.id,
      label: author.name ?? tCommonStates('unknown'),
    })) ?? [];
  const sortByOptions = getSortByOptions({
    published: tCommonLabels('published'),
    updated: tCommonLabels('updated'),
    title: tCommonLabels('title'),
  });

  const updateProp = useCallback(
    (key: keyof PostListProps, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [props, updateProps],
  );

  const updateBaseProp = useCallback(
    (key: string, value: string) => {
      if (key === 'showImage') {
        updateProp('showFeaturedImage', value);
        return;
      }

      updateProp(key as keyof PostListProps, value);
    },
    [updateProp],
  );

  return (
    <ListBlockEditorBase
      editorType="post-list"
      limitLabel={tPageEditor('blockEditor.labels.numberOfPosts')}
      layout={layout}
      columns={columns}
      limit={limit}
      maxLimit={MAX_LIMIT_POSTS}
      defaultColumns="3"
      defaultLimit="6"
      sortBy={sortBy}
      sortByOptions={sortByOptions}
      sortOrder={sortOrder}
      showPagination={showPagination}
      showImage={showFeaturedImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      filters={
        <>
          <MultiSelect
            label={tCommonEntities('categories')}
            placeholder={tPageEditor('mapEditor.allCategoriesPlaceholder')}
            data={categoryOptions}
            value={categoryIds ? categoryIds.split(',').filter(Boolean) : []}
            onChange={(values) => updateProp('categoryIds', values.join(','))}
            size="xs"
            clearable
            searchable
          />
          <Select
            label={tCommonEntities('series')}
            placeholder={tPageEditor('mapEditor.allSeriesPlaceholder')}
            data={seriesOptions}
            value={seriesId || null}
            onChange={(value) => updateProp('seriesId', value || '')}
            size="xs"
            clearable
            searchable
          />
          <MultiSelect
            label={tCommonLabels('authors')}
            placeholder={tPageEditor('mapEditor.allAuthorsPlaceholder')}
            data={authorOptions}
            value={authorIds ? authorIds.split(',').filter(Boolean) : []}
            onChange={(values) => updateProp('authorIds', values.join(','))}
            size="xs"
            clearable
            searchable
          />
          <MultiSelect
            label={tCommonEntities('tags')}
            placeholder={tPageEditor('mapEditor.allTagsPlaceholder')}
            data={tagOptions}
            value={tagIds ? tagIds.split(',').filter(Boolean) : []}
            onChange={(values) => updateProp('tagIds', values.join(','))}
            size="xs"
            clearable
            searchable
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
      onUpdate={updateBaseProp}
    />
  );
}

export function PostListSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<PostListProps>) {
  return <PostListSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function PostListEditor({ sectionId, props }: BlockEditorProps<PostListProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <PostListSettingsForm props={props} updateProps={updateProps} />;
}

export function PostListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<PostListProps>) {
  return <PostListView sectionId={sectionId} props={{ ...props }} />;
}
