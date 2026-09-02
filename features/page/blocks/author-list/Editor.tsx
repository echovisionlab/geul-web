'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconTrash, IconUserPlus } from '@tabler/icons-react';
import { Avatar, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { IconButton } from '@/components/core/IconButton';
import { Select, NumberInput, SegmentedControl, Switch } from '@/components/core/Input';
import { SearchCombobox } from '@/features/search/SearchCombobox';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { listAuthorsAction } from '@/lib/actions/user';
import { searchMembers } from '@/lib/queries/user-browser';
import { COLUMN_OPTIONS, getLayoutOptionsGridList, MAX_LIMIT_AUTHORS } from '../constants';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { parseAuthorIds, type AuthorListProps } from './schema';
import { AuthorListView } from './View';

const MAX_SELECTED_AUTHORS = 24;

interface AuthorListSettingsFormProps {
  props: Partial<AuthorListProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function AuthorListSettingsForm({ props, updateProps }: AuthorListSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');

  const source = props.source || 'automatic';
  const selectedIds = parseAuthorIds(props.authorIds || '');
  const layout = props.layout || 'grid';
  const columns = props.columns || '3';
  const limit = props.limit || '6';
  const showBio = props.showBio || 'true';
  const showAvatar = props.showAvatar || 'true';
  const layoutOptions = getLayoutOptionsGridList({
    grid: tPageEditor('blockEditor.options.layout.grid'),
    list: tPageEditor('blockEditor.options.layout.list'),
  });
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();

  const { data: selectedAuthors = [], isFetched: selectedAuthorsFetched } = useQuery({
    queryKey: ['users', 'authors', 'selected', selectedIds],
    queryFn: () => listAuthorsAction(MAX_SELECTED_AUTHORS, selectedIds),
    enabled: source === 'selected' && selectedIds.length > 0,
  });
  const selectedAuthorsById = useMemo(
    () => new Map(selectedAuthors.map((author) => [author.id, author])),
    [selectedAuthors],
  );
  const { data: candidates = [], isFetching: candidatesFetching } = useQuery({
    queryKey: ['members', 'author-candidates', debouncedSearch, selectedIds],
    queryFn: () => searchMembers(debouncedSearch, selectedIds, 10, true),
    enabled: source === 'selected' && isEnabled && selectedIds.length < MAX_SELECTED_AUTHORS,
  });

  const updateProp = useCallback(
    (key: keyof AuthorListProps, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [updateProps, props],
  );

  const updateSelectedIds = useCallback((ids: string[]) => updateProp('authorIds', ids.join(',')), [updateProp]);

  const moveSelectedAuthor = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= selectedIds.length) {
        return;
      }
      const next = [...selectedIds];
      [next[index], next[target]] = [next[target], next[index]];
      updateSelectedIds(next);
    },
    [selectedIds, updateSelectedIds],
  );

  return (
    <Box data-page-block-editor="author-list">
      <Stack gap="sm">
        <Select
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
          size="xs"
        />

        {source === 'selected' ? (
          <Stack gap="xs">
            {selectedIds.length < MAX_SELECTED_AUTHORS ? (
              <SearchCombobox
                combobox={combobox}
                search={search}
                onSearchChange={setSearch}
                placeholder={tCommonLabels('authors')}
                label={tCommonLabels('authors')}
                leftSection={<IconUserPlus size={14} />}
                items={candidates}
                isLoading={candidatesFetching}
                debouncedSearch={debouncedSearch}
                onSelect={(memberId) => {
                  if (!selectedIds.includes(memberId)) {
                    updateSelectedIds([...selectedIds, memberId]);
                  }
                  reset();
                }}
                renderItem={(candidate) => (
                  <Group gap="xs" wrap="nowrap">
                    <Avatar src={candidate.avatarUrl} size="xs" radius="xl">
                      {candidate.nickname.charAt(0)}
                    </Avatar>
                    <Text size="xs" truncate>
                      {candidate.nickname}
                    </Text>
                  </Group>
                )}
                getItemId={(candidate) => candidate.id}
              />
            ) : (
              <Text size="xs" c="dimmed">
                Maximum {MAX_SELECTED_AUTHORS} authors selected
              </Text>
            )}

            {selectedIds.length === 0 ? (
              <Text size="xs" c="dimmed">
                No authors selected. This block will be empty.
              </Text>
            ) : (
              selectedIds.map((memberId, index) => {
                const author = selectedAuthorsById.get(memberId);
                const unavailable = selectedAuthorsFetched && !author;
                return (
                  <Paper key={memberId} withBorder p="xs" radius="sm">
                    <Group gap="xs" wrap="nowrap">
                      <Avatar src={author?.image} size="sm" radius="xl">
                        {author?.name?.charAt(0) ?? '?'}
                      </Avatar>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" truncate>
                          {author?.name ?? memberId}
                        </Text>
                        {unavailable ? (
                          <Text size="xs" c="red">
                            This author is no longer available.
                          </Text>
                        ) : null}
                      </Box>
                      <IconButton
                        aria-label={`Move ${author?.name ?? memberId} up`}
                        size="xs"
                        disabled={index === 0}
                        onClick={() => moveSelectedAuthor(index, -1)}
                      >
                        <IconArrowUp size={13} />
                      </IconButton>
                      <IconButton
                        aria-label={`Move ${author?.name ?? memberId} down`}
                        size="xs"
                        disabled={index === selectedIds.length - 1}
                        onClick={() => moveSelectedAuthor(index, 1)}
                      >
                        <IconArrowDown size={13} />
                      </IconButton>
                      <IconButton
                        aria-label={`Remove ${author?.name ?? memberId}`}
                        size="xs"
                        tone="danger"
                        onClick={() => updateSelectedIds(selectedIds.filter((id) => id !== memberId))}
                      >
                        <IconTrash size={13} />
                      </IconButton>
                    </Group>
                  </Paper>
                );
              })
            )}

            {selectedAuthorsFetched && selectedAuthors.length < selectedIds.length ? (
              <Alert icon={<IconAlertTriangle size={14} />} tone="warning" p="xs">
                Unavailable authors are omitted from the public page. Remove them or select a replacement.
              </Alert>
            ) : null}
          </Stack>
        ) : null}

        <Text size="xs" c="dimmed" fw={500}>
          {tPageEditor('blockEditor.sections.layout')}
        </Text>
        <SegmentedControl
          data={[...layoutOptions]}
          value={layout}
          onChange={(value) => updateProp('layout', value)}
          size="xs"
          fullWidth
        />

        {layout === 'grid' && (
          <Select
            label={tPageEditor('blockEditor.labels.columns')}
            data={[...COLUMN_OPTIONS]}
            value={columns}
            onChange={(value) => updateProp('columns', value || '3')}
            size="xs"
          />
        )}

        {source === 'automatic' ? (
          <NumberInput
            label={tPageEditor('blockEditor.labels.numberOfAuthors')}
            value={parseInt(limit, 10)}
            onChange={(value) => updateProp('limit', String(value || 6))}
            min={1}
            max={MAX_LIMIT_AUTHORS}
            size="xs"
          />
        ) : null}

        <Text size="xs" c="dimmed" fw={500} mt="xs">
          {tPageEditor('blockEditor.sections.displayOptions')}
        </Text>

        <Switch
          label={tPageEditor('blockEditor.labels.showBio')}
          checked={showBio === 'true'}
          onChange={(e) => updateProp('showBio', e.currentTarget.checked ? 'true' : 'false')}
          size="sm"
        />
        <Switch
          label="Show avatar"
          checked={showAvatar === 'true'}
          onChange={(e) => updateProp('showAvatar', e.currentTarget.checked ? 'true' : 'false')}
          size="sm"
        />
      </Stack>
    </Box>
  );
}

export function AuthorListSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<AuthorListProps>) {
  return <AuthorListSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function AuthorListEditor({ sectionId, props }: BlockEditorProps<AuthorListProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <AuthorListSettingsForm props={props} updateProps={updateProps} />;
}

export function AuthorListCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<AuthorListProps>) {
  return <AuthorListView sectionId={sectionId} props={{ ...props }} />;
}
