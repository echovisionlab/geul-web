'use client';

import { useCallback } from 'react';
import { IconFilter, IconTable } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { MultiSelect, Select, NumberInput } from '@/components/core/Input';
import { listCategoriesAction } from '@/lib/actions/category';
import { listTagsAction } from '@/lib/actions/tag';
import { listAuthorOptionsAction } from '@/lib/actions/user';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listSeriesSimple } from '@/lib/queries/series-browser';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { PostTableProps } from './schema';
import {
  parsePostTableFilterFields,
  parsePostTableSortFields,
  POST_TABLE_FILTER_FIELD_DEFINITIONS,
  POST_TABLE_SORT_FIELD_DEFINITIONS,
} from './spec';
import { PostTableView } from './View';

interface PostTableSettingsFormProps {
  props: Partial<PostTableProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function PostTableSettingsForm({ props, updateProps }: PostTableSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tCommonStatuses = useTranslations('common.statuses');
  const categoryIds = props.categoryIds || '';
  const tagIds = props.tagIds || '';
  const authorIds = props.authorIds || '';
  const seriesId = props.seriesId || '';
  const statuses = props.statuses || 'POST_STATUS_PUBLISHED,POST_STATUS_ARCHIVED';
  const filterFields = parsePostTableFilterFields(props.filterFields);
  const sortFields = parsePostTableSortFields(props.sortFields);
  const pageSize = props.pageSize || '10';

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategoriesAction(),
  });
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsAction(),
  });
  const { data: authors } = useQuery({
    queryKey: ['authors', 50],
    queryFn: () => listAuthorOptionsAction(50),
  });
  const { data: series } = useQuery({
    queryKey: ['series', 'simple'],
    queryFn: () => listSeriesSimple(),
  });
  const statusOptions = [
    { value: 'POST_STATUS_PUBLISHED', label: tCommonStatuses('published') },
    { value: 'POST_STATUS_ARCHIVED', label: tCommonStatuses('archived') },
  ];
  const filterFieldLabels: Record<string, string> = {
    category_id: tCommonEntities('category'),
    tag_id: tCommonEntities('tag'),
    author_id: tCommonLabels('author'),
    series_id: tCommonEntities('series'),
    status: tCommonLabels('status'),
    published_at: tCommonLabels('published'),
  };
  const sortFieldLabels: Record<string, string> = {
    published_at: tCommonLabels('published'),
    title: tCommonLabels('title'),
  };

  const updateProp = useCallback(
    (key: keyof PostTableProps, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [props, updateProps],
  );

  return (
    <Box data-page-block-editor="post-table">
      <Group gap="xs" mb="md">
        <IconTable size={18} />
        <Text size="sm" fw={500}>
          {tPageEditor('sectionTypes.postTable')}
        </Text>
        <LabelBadge size="sm" tone="neutral">
          {tPageEditor('blockEditor.badges.rows', { count: pageSize })}
        </LabelBadge>
      </Group>

      <Stack gap="sm">
        <Group gap="xs">
          <IconFilter size={14} />
          <Text size="xs" c="dimmed" fw={500}>
            {tPageEditor('blockEditor.sections.defaultFilters')}
          </Text>
        </Group>

        <MultiSelect
          label={tCommonEntities('categories')}
          placeholder={tPageEditor('mapEditor.allCategoriesPlaceholder')}
          data={(categories ?? []).map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          value={categoryIds ? categoryIds.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('categoryIds', values.join(','))}
          size="xs"
          searchable
          clearable
        />

        <Select
          label={tCommonEntities('series')}
          placeholder={tPageEditor('mapEditor.allSeriesPlaceholder')}
          data={(series ?? []).map((item) => ({ value: item.id, label: item.title }))}
          value={seriesId || null}
          onChange={(value) => updateProp('seriesId', value || '')}
          size="xs"
          searchable
          clearable
        />

        <MultiSelect
          label={tCommonLabels('status')}
          placeholder={tPageEditor('blockEditor.placeholders.publishedByDefault')}
          data={statusOptions}
          value={statuses ? statuses.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('statuses', values.join(','))}
          size="xs"
          clearable
        />

        <MultiSelect
          label={tCommonLabels('authors')}
          placeholder={tPageEditor('mapEditor.allAuthorsPlaceholder')}
          data={(authors ?? []).map((author) => ({
            value: author.id,
            label: author.name ?? tCommonStates('unknown'),
          }))}
          value={authorIds ? authorIds.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('authorIds', values.join(','))}
          size="xs"
          searchable
          clearable
        />

        <MultiSelect
          label={tCommonEntities('tags')}
          placeholder={tPageEditor('mapEditor.allTagsPlaceholder')}
          data={(tags ?? []).map((tag) => ({ value: tag.id, label: tag.name }))}
          value={tagIds ? tagIds.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('tagIds', values.join(','))}
          size="xs"
          searchable
          clearable
        />

        <MultiSelect
          label={tPageEditor('blockEditor.labels.exposedFilters')}
          data={POST_TABLE_FILTER_FIELD_DEFINITIONS.map((field) => ({
            value: field.field,
            label: filterFieldLabels[field.field] ?? field.label,
          }))}
          value={filterFields}
          onChange={(values) => updateProp('filterFields', values.join(','))}
          size="xs"
          clearable
        />

        <MultiSelect
          label={tPageEditor('blockEditor.labels.exposedSorts')}
          data={POST_TABLE_SORT_FIELD_DEFINITIONS.map((field) => ({
            value: field.field,
            label: sortFieldLabels[field.field] ?? field.label,
          }))}
          value={sortFields}
          onChange={(values) => updateProp('sortFields', values.join(','))}
          size="xs"
          clearable
        />
      </Stack>

      <Divider my="sm" />

      <NumberInput
        label={tPageEditor('blockEditor.labels.rowsPerPage')}
        value={parseInt(pageSize, 10)}
        onChange={(value) => updateProp('pageSize', String(value || 10))}
        min={1}
        max={50}
        size="xs"
      />
    </Box>
  );
}

export function PostTableSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<PostTableProps>) {
  return <PostTableSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function PostTableEditor({ sectionId, props }: BlockEditorProps<PostTableProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <PostTableSettingsForm props={props} updateProps={updateProps} />;
}

export function PostTableCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<PostTableProps>) {
  return <PostTableView sectionId={sectionId} props={{ ...props }} />;
}
