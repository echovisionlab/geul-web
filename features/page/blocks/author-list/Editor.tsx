'use client';
import { PageLoader } from '@/features/site/PageLoader';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconTrash, IconUserPlus } from '@tabler/icons-react';

import { Avatar } from '@/components/core/Display';
import { Alert } from '@/components/core/Alert';
import { IconButton } from '@/components/core/IconButton';
import { Select, NumberInput, SegmentedControl, Switch } from '@/components/core/Input';
import { SearchCombobox } from '@/features/search/SearchCombobox';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { listAuthorsAction } from '@/lib/actions/user';
import { searchMembers } from '@/lib/queries/user-browser';
import { getLayoutOptionsGridList, MAX_LIMIT_AUTHORS } from '../constants';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { parseAuthorIds, type AuthorListProps } from './schema';
import { AuthorListView } from './View';
import { CollectionSizeControl } from '../CollectionSizeControl';

const MAX_SELECTED_AUTHORS = 24;

interface AuthorListSettingsFormProps {
  readOnly?: boolean;
  props: Partial<AuthorListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function AuthorListSettingsForm({ props, updateProps, readOnly = false }: AuthorListSettingsFormProps) {
  const t = useTranslations();
  const tPageEditor = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');

  const source = props.source || 'automatic';
  const selectedIds = parseAuthorIds(props.authorIds || '');
  const layout = props.layout || 'grid';
  const limit = props.limit || '6';
  const showBio = props.showBio || 'true';
  const showAvatar = props.showAvatar || 'true';
  const layoutOptions = getLayoutOptionsGridList({
    grid: tPageEditor('blockEditor.options.layout.grid'),
    list: tPageEditor('blockEditor.options.layout.list'),
  });
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();

  const selectedAuthorsQuery = useQuery({
    queryKey: ['users', 'authors', 'selected', selectedIds],
    queryFn: () => listAuthorsAction(MAX_SELECTED_AUTHORS, selectedIds),
    enabled: source === 'selected' && selectedIds.length > 0,
  });
  const { data: selectedAuthors = [] } = selectedAuthorsQuery;
  const selectedAuthorsFetched = selectedAuthorsQuery.data !== undefined;
  const selectedAuthorsById = useMemo(
    () => new Map(selectedAuthors.map((author) => [author.id, author])),
    [selectedAuthors],
  );
  const candidatesQuery = useQuery({
    queryKey: ['members', 'author-candidates', debouncedSearch, selectedIds],
    queryFn: () => searchMembers(debouncedSearch, selectedIds, 10, true),
    enabled: source === 'selected' && !readOnly && isEnabled && selectedIds.length < MAX_SELECTED_AUTHORS,
  });
  const { data: candidates = [], isFetching: candidatesFetching } = candidatesQuery;

  const updateProp = useCallback(
    (key: keyof AuthorListProps, value: string) => {
      if (readOnly) {
        return;
      }
      updateProps({ [key]: value });
    },
    [readOnly, updateProps],
  );

  const updateSelectedIds = useCallback(
    (ids: string[]) => {
      if (readOnly) {
        return;
      }
      updateProp('authorIds', ids.join(','));
    },
    [readOnly, updateProp],
  );

  const moveSelectedAuthor = useCallback(
    (index: number, direction: -1 | 1) => {
      if (readOnly) {
        return;
      }
      const target = index + direction;
      if (target < 0 || target >= selectedIds.length) {
        return;
      }
      const next = [...selectedIds];
      [next[index], next[target]] = [next[target], next[index]];
      updateSelectedIds(next);
    },
    [readOnly, selectedIds, updateSelectedIds],
  );

  return (
    <div data-page-block-editor="author-list">
      <QueryErrorAlert queries={[selectedAuthorsQuery, candidatesQuery]} />
      <DsLayoutStack gap="md">
        <Select
          disabled={readOnly}
          label={tPageEditor('blockEditor.labels.source')}
          data={[
            {
              value: 'automatic',
              label: tPageEditor('blockEditor.options.source.all'),
            },
            {
              value: 'selected',
              label: tPageEditor('blockEditor.options.source.selected'),
            },
          ]}
          value={source}
          onChange={(value) => updateProp('source', value || 'automatic')}
        />

        {source === 'selected' ? (
          <DsLayoutStack gap="xs">
            {selectedIds.length < MAX_SELECTED_AUTHORS ? (
              <SearchCombobox
                disabled={readOnly}
                combobox={combobox}
                search={search}
                onSearchChange={(value) => {
                  if (!readOnly) {
                    setSearch(value);
                  }
                }}
                placeholder={tCommonLabels('authors')}
                label={tCommonLabels('authors')}
                leftSection={<IconUserPlus size={14} />}
                items={candidates}
                isLoading={candidatesFetching}
                error={candidatesQuery.isError ? t('common.errors.generic') : undefined}
                emptyMessage={candidatesQuery.isError ? t('common.errors.generic') : undefined}
                debouncedSearch={debouncedSearch}
                onSelect={(memberId) => {
                  if (readOnly) {
                    return;
                  }
                  if (!selectedIds.includes(memberId)) {
                    updateSelectedIds([...selectedIds, memberId]);
                  }
                  reset();
                }}
                renderItem={(candidate) => (
                  <DsLayoutInline gap="xs" wrap="nowrap">
                    <Avatar src={candidate.avatarUrl} size="xs" shape="circle" name={candidate.nickname} />
                    <DsText size="xs" truncate>
                      {candidate.nickname}
                    </DsText>
                  </DsLayoutInline>
                )}
                getItemId={(candidate) => candidate.id}
                getItemText={(candidate) => candidate.nickname}
              />
            ) : (
              <DsText size="xs" tone="secondary">
                {tPageEditor('blockEditor.authorSelection.maxSelected', { count: MAX_SELECTED_AUTHORS })}
              </DsText>
            )}

            {selectedIds.length === 0 ? (
              <DsText size="xs" tone="secondary">
                {tPageEditor('blockEditor.authorSelection.empty')}
              </DsText>
            ) : selectedAuthorsQuery.isLoading ? (
              <PageLoader placement="flow" extent="compact" size="xs" />
            ) : (
              selectedAuthorsFetched &&
              selectedIds.map((memberId, index) => {
                const author = selectedAuthorsById.get(memberId);
                const authorName = author?.name?.trim() || t('common.states.unknownAuthor');
                const unavailable = selectedAuthorsFetched && !author;
                return (
                  <DsSectionCard withBorder padding="xs" key={memberId}>
                    <DsLayoutInline gap="xs" wrap="nowrap">
                      <Avatar src={author?.image} size="sm" shape="circle" name={authorName} />
                      <DsLayoutInset flexible space="none">
                        <DsText size="xs" truncate>
                          {authorName}
                        </DsText>
                        {unavailable ? (
                          <DsText size="xs" tone="danger">
                            {tPageEditor('blockEditor.authorSelection.unavailable')}
                          </DsText>
                        ) : null}
                      </DsLayoutInset>
                      <IconButton
                        aria-label={t('dataTable.sort.aria.moveUp', { label: authorName })}
                        size="xs"
                        disabled={readOnly || index === 0}
                        onClick={() => moveSelectedAuthor(index, -1)}
                      >
                        <IconArrowUp size={13} />
                      </IconButton>
                      <IconButton
                        aria-label={t('dataTable.sort.aria.moveDown', { label: authorName })}
                        size="xs"
                        disabled={readOnly || index === selectedIds.length - 1}
                        onClick={() => moveSelectedAuthor(index, 1)}
                      >
                        <IconArrowDown size={13} />
                      </IconButton>
                      <IconButton
                        aria-label={t('postMembers.removeAria', { name: authorName })}
                        disabled={readOnly}
                        size="xs"
                        tone="danger"
                        onClick={() => updateSelectedIds(selectedIds.filter((id) => id !== memberId))}
                      >
                        <IconTrash size={13} />
                      </IconButton>
                    </DsLayoutInline>
                  </DsSectionCard>
                );
              })
            )}

            {selectedAuthorsFetched && selectedAuthors.length < selectedIds.length ? (
              <Alert density="compact" icon={<IconAlertTriangle size={14} />} tone="warning">
                {tPageEditor('blockEditor.authorSelection.unavailableWarning')}
              </Alert>
            ) : null}
          </DsLayoutStack>
        ) : null}

        <DsText size="xs" tone="secondary" weight="medium">
          {tPageEditor('blockEditor.sections.layout')}
        </DsText>
        <SegmentedControl
          disabled={readOnly}
          data={[...layoutOptions]}
          value={layout}
          onChange={(value) => updateProp('layout', value)}
          fullWidth
        />

        <CollectionSizeControl
          disabled={readOnly}
          value={props.itemSize}
          onChange={(value) => updateProp('itemSize', value)}
        />

        {source === 'automatic' ? (
          <NumberInput
            disabled={readOnly}
            label={tPageEditor('blockEditor.labels.numberOfAuthors')}
            value={parseInt(limit, 10)}
            onChange={(value) => updateProp('limit', String(value || 6))}
            min={1}
            max={MAX_LIMIT_AUTHORS}
          />
        ) : null}

        <DsLayoutInset blockStart="xs">
          <DsText size="xs" tone="secondary" weight="medium">
            {tPageEditor('blockEditor.sections.displayOptions')}
          </DsText>
        </DsLayoutInset>

        <Switch
          disabled={readOnly}
          label={tPageEditor('blockEditor.labels.showBio')}
          checked={showBio === 'true'}
          onChange={(e) => updateProp('showBio', e.currentTarget.checked ? 'true' : 'false')}
        />
        <Switch
          disabled={readOnly}
          label={tPageEditor('blockEditor.labels.showAvatar')}
          checked={showAvatar === 'true'}
          onChange={(e) => updateProp('showAvatar', e.currentTarget.checked ? 'true' : 'false')}
        />
      </DsLayoutStack>
    </div>
  );
}

export function AuthorListSettingsEditor({
  props,
  updateSharedProps,
  allowSharedEdits,
}: BlockSettingsEditorProps<AuthorListProps>) {
  return <AuthorListSettingsForm props={props} updateProps={updateSharedProps} readOnly={allowSharedEdits === false} />;
}

export function AuthorListEditor({ sectionId, props }: BlockEditorProps<AuthorListProps>) {
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
    <AuthorListSettingsForm props={props} updateProps={updateProps} readOnly={!editable || !allowStructuralEdits} />
  );
}

export function AuthorListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<AuthorListProps>) {
  return <AuthorListView sectionId={sectionId} props={{ ...props }} />;
}
