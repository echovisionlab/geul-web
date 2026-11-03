'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

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
  readOnly?: boolean;
  props: Partial<PostListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function PostListSettingsForm({ props, updateProps, readOnly = false }: PostListSettingsFormProps) {
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

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategoriesAction().then(unwrapQueryResult),
  });
  const { data: categories } = categoriesQuery;
  const seriesListQuery = useQuery({
    queryKey: ['series', 'simple'],
    queryFn: () => listSeriesSimple(),
  });
  const { data: seriesList } = seriesListQuery;
  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsAction().then(unwrapQueryResult),
  });
  const { data: tags } = tagsQuery;
  const authorsQuery = useQuery({
    queryKey: ['authors', 50],
    queryFn: () => listAuthorOptionsAction(50),
  });
  const { data: authorsData } = authorsQuery;

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
      if (readOnly) {
        return;
      }
      updateProps({ [key]: value });
    },
    [readOnly, updateProps],
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
    <>
      <QueryErrorAlert queries={[categoriesQuery, seriesListQuery, tagsQuery, authorsQuery]} />
      <ListBlockEditorBase
        readOnly={readOnly}
        editorType="post-list"
        limitLabel={tPageEditor('blockEditor.labels.numberOfPosts')}
        layout={layout}
        itemSize={props.itemSize}
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
              disabled={readOnly}
              label={tCommonEntities('categories')}
              placeholder={tPageEditor('mapEditor.allCategoriesPlaceholder')}
              isLoading={categoriesQuery.isLoading}
              data={categoryOptions}
              value={categoryIds ? categoryIds.split(',').filter(Boolean) : []}
              onChange={(values) => updateProp('categoryIds', values.join(','))}
              clearable
              searchable
            />
            <Select
              disabled={readOnly}
              label={tCommonEntities('series')}
              placeholder={tPageEditor('mapEditor.allSeriesPlaceholder')}
              isLoading={seriesListQuery.isLoading}
              data={seriesOptions}
              value={seriesId || null}
              onChange={(value) => updateProp('seriesId', value || '')}
              clearable
              searchable
            />
            <MultiSelect
              disabled={readOnly}
              label={tCommonLabels('authors')}
              placeholder={tPageEditor('mapEditor.allAuthorsPlaceholder')}
              isLoading={authorsQuery.isLoading}
              data={authorOptions}
              value={authorIds ? authorIds.split(',').filter(Boolean) : []}
              onChange={(values) => updateProp('authorIds', values.join(','))}
              clearable
              searchable
            />
            <MultiSelect
              disabled={readOnly}
              label={tCommonEntities('tags')}
              placeholder={tPageEditor('mapEditor.allTagsPlaceholder')}
              isLoading={tagsQuery.isLoading}
              data={tagOptions}
              value={tagIds ? tagIds.split(',').filter(Boolean) : []}
              onChange={(values) => updateProp('tagIds', values.join(','))}
              clearable
              searchable
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
        onUpdate={updateBaseProp}
      />
    </>
  );
}

export function PostListSettingsEditor({
  props,
  updateSharedProps,
  allowSharedEdits,
}: BlockSettingsEditorProps<PostListProps>) {
  return <PostListSettingsForm props={props} updateProps={updateSharedProps} readOnly={allowSharedEdits === false} />;
}

export function PostListEditor({ sectionId, props }: BlockEditorProps<PostListProps>) {
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

  return <PostListSettingsForm props={props} updateProps={updateProps} readOnly={!editable || !allowStructuralEdits} />;
}

export function PostListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<PostListProps>) {
  return <PostListView sectionId={sectionId} props={{ ...props }} />;
}
