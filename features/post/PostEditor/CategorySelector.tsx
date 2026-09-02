'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { MultiSelectCombobox } from '@/features/post/MultiSelectCombobox';
import { createCategoryAction, listCategoriesAction } from '@/lib/actions/category';
import type { Category } from '@/lib/collab/post-meta';
import { usePostMeta } from '@/lib/contexts/PostMetaContext';
import type { CategorySelect } from '@/lib/types/category/model';

interface CategorySelectorProps {
  postId: string;
  canEdit: boolean;
  isAdmin: boolean;
  categories: CategorySelect[];
}

export function CategorySelector({ postId, canEdit, isAdmin, categories: initialCategories }: CategorySelectorProps) {
  const t = useTranslations('postEditor.categorySelector');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const { categoryIds, setCategoryIds } = usePostMeta();
  const queryClient = useQueryClient();

  // Convert initialCategories to ensure slug is string (not undefined)
  const normalizedInitialCategories = initialCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug ?? '',
  }));

  // Use initialData to avoid loading state, staleTime: Infinity to prevent refetch
  const { data: categories = normalizedInitialCategories, isLoading } = useQuery({
    queryKey: ['category', 'list'],
    queryFn: async () => {
      const result = await listCategoriesAction();
      // Ensure slug is always string
      return result.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug ?? '',
      }));
    },
    initialData: normalizedInitialCategories,
    staleTime: Infinity,
  });

  const selectedCategories = useMemo(
    () => categoryIds.map((id) => categories.find((category) => category.id === id) ?? { id, name: id, slug: '' }),
    [categories, categoryIds],
  );

  const createCategory = useMutation({
    mutationFn: (name: string) => createCategoryAction({ name }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: ['category', 'list'] });
        const newCategory: Category = {
          id: result.data.id,
          name: result.data.name,
          slug: result.data.slug ?? '',
        };
        setCategoryIds([...categoryIds, newCategory.id]);
        notifications.show({ message: tCommonNotifications('categoryCreated'), color: 'green' });
      }
    },
  });

  const handleSelect = useCallback(
    (category: Category) => {
      if (!canEdit) {
        return;
      }
      setCategoryIds([...categoryIds, category.id]);
    },
    [canEdit, categoryIds, setCategoryIds],
  );

  const handleDeselect = useCallback(
    (category: Category) => {
      if (!canEdit) {
        return;
      }
      setCategoryIds(categoryIds.filter((id) => id !== category.id));
    },
    [canEdit, categoryIds, setCategoryIds],
  );

  const handleCreate = useCallback(
    (name: string) => {
      if (!canEdit || !isAdmin) {
        return;
      }
      createCategory.mutate(name);
    },
    [canEdit, createCategory, isAdmin],
  );

  return (
    <MultiSelectCombobox
      label={tCommonEntities('categories')}
      idPrefix={`post-${postId}-categories`}
      placeholder={t('placeholder')}
      emptyMessage={t('emptyMessage')}
      notFoundMessage={t('notFoundMessage')}
      selectedItems={selectedCategories}
      options={categories}
      isLoading={isLoading}
      isCreating={createCategory.isPending}
      onSelect={handleSelect}
      onDeselect={handleDeselect}
      onCreate={handleCreate}
      canEdit={canEdit}
      canCreateNew={canEdit && isAdmin}
    />
  );
}
