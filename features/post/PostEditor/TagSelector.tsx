'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { MultiSelectCombobox } from '@/features/post/MultiSelectCombobox';
import { createTagAction, listTagsAction } from '@/lib/actions/tag';
import type { Tag } from '@/lib/collab/post-meta';
import { usePostMeta } from '@/lib/contexts/PostMetaContext';
import type { TagSelect } from '@/lib/types/tag/model';

interface TagSelectorProps {
  postId: string;
  canEdit: boolean;
  isAdmin: boolean;
  tags: TagSelect[];
}

export function TagSelector({ postId, canEdit, isAdmin, tags: initialTags }: TagSelectorProps) {
  const t = useTranslations('postEditor.tagSelector');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const { tagIds, setTagIds } = usePostMeta();
  const queryClient = useQueryClient();

  // Convert initialTags to ensure slug is string (not undefined)
  const normalizedInitialTags = initialTags.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug ?? '',
  }));

  // Use initialData to avoid loading state, staleTime: Infinity to prevent refetch
  const { data: tags = normalizedInitialTags, isLoading } = useQuery({
    queryKey: ['tag', 'list'],
    queryFn: async () => {
      const result = await listTagsAction();
      // Ensure slug is always string
      return result.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug ?? '',
      }));
    },
    initialData: normalizedInitialTags,
    staleTime: Infinity,
  });

  const selectedTags = useMemo(
    () => tagIds.map((id) => tags.find((tag) => tag.id === id) ?? { id, name: id, slug: '' }),
    [tagIds, tags],
  );

  const createTag = useMutation({
    mutationFn: (name: string) => createTagAction(name),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: ['tag', 'list'] });
        const newTag: Tag = {
          id: result.data.id,
          name: result.data.name,
          slug: result.data.slug ?? '',
        };
        setTagIds([...tagIds, newTag.id]);
        notifications.show({ message: tCommonNotifications('tagCreated'), color: 'green' });
      }
    },
  });

  const handleSelect = useCallback(
    (tag: Tag) => {
      if (!canEdit) {
        return;
      }
      setTagIds([...tagIds, tag.id]);
    },
    [canEdit, setTagIds, tagIds],
  );

  const handleDeselect = useCallback(
    (tag: Tag) => {
      if (!canEdit) {
        return;
      }
      setTagIds(tagIds.filter((id) => id !== tag.id));
    },
    [canEdit, setTagIds, tagIds],
  );

  const handleCreate = useCallback(
    (name: string) => {
      if (!canEdit || !isAdmin) {
        return;
      }
      createTag.mutate(name);
    },
    [canEdit, createTag, isAdmin],
  );

  return (
    <MultiSelectCombobox
      label={tCommonEntities('tags')}
      idPrefix={`post-${postId}-tags`}
      placeholder={t('placeholder')}
      emptyMessage={t('emptyMessage')}
      notFoundMessage={t('notFoundMessage')}
      selectedItems={selectedTags}
      options={tags}
      isLoading={isLoading}
      isCreating={createTag.isPending}
      onSelect={handleSelect}
      onDeselect={handleDeselect}
      onCreate={handleCreate}
      canEdit={canEdit}
      canCreateNew={canEdit && isAdmin}
      combineWithSelected
    />
  );
}
