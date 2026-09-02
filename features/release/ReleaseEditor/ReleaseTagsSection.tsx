'use client';

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SimpleGrid, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { MultiSelect } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { listCategoriesAction } from '@/lib/actions/category';
import { listFormatsAction } from '@/lib/actions/format';
import { listGenresAction } from '@/lib/actions/genre';
import {
  setReleaseCategoriesAction,
  setReleaseFormatsAction,
  setReleaseGenresAction,
  setReleaseStylesAction,
} from '@/lib/actions/release';
import { listStylesAction } from '@/lib/actions/style';
import type {
  ReleaseCategoryItem,
  ReleaseFormatItem,
  ReleaseGenreItem,
  ReleaseStyleItem,
} from '@/lib/types/release/model';

interface ReleaseTagsSectionProps {
  releaseId: string;
  idPrefix?: string;
  categories: ReleaseCategoryItem[];
  genres: ReleaseGenreItem[];
  styles: ReleaseStyleItem[];
  formats: ReleaseFormatItem[];
  onCategoriesChange: (categories: ReleaseCategoryItem[]) => void;
  onGenresChange: (genres: ReleaseGenreItem[]) => void;
  onStylesChange: (styles: ReleaseStyleItem[]) => void;
  onFormatsChange: (formats: ReleaseFormatItem[]) => void;
}

export function ReleaseTagsSection({
  releaseId,
  idPrefix,
  categories,
  genres,
  styles,
  formats,
  onCategoriesChange,
  onGenresChange,
  onStylesChange,
  onFormatsChange,
}: ReleaseTagsSectionProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tags');
  const tCategorySelector = useTranslations('postEditor.categorySelector');
  const { data: allCategories } = useQuery({
    queryKey: ['category', 'list'],
    queryFn: () => listCategoriesAction(),
  });
  const { data: allGenres } = useQuery({
    queryKey: ['genre', 'list'],
    queryFn: () => listGenresAction(),
  });
  const { data: allStyles } = useQuery({
    queryKey: ['style', 'list'],
    queryFn: () => listStylesAction(),
  });
  const { data: allFormats } = useQuery({
    queryKey: ['format', 'list'],
    queryFn: () => listFormatsAction(),
  });

  const setCategories = useMutation({
    mutationFn: (categoryIds: string[]) => setReleaseCategoriesAction(releaseId, categoryIds),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.categories') }),
        color: 'green',
      });
    },
  });

  const setGenres = useMutation({
    mutationFn: (genreIds: string[]) => setReleaseGenresAction(releaseId, genreIds),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.genres') }),
        color: 'green',
      });
    },
  });

  const setStyles = useMutation({
    mutationFn: (styleIds: string[]) => setReleaseStylesAction(releaseId, styleIds),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.styles') }),
        color: 'green',
      });
    },
  });

  const setFormats = useMutation({
    mutationFn: (formatIds: string[]) =>
      setReleaseFormatsAction(
        releaseId,
        formatIds.map((id) => ({ formatId: id })),
      ),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.formats') }),
        color: 'green',
      });
    },
  });

  const handleCategoriesChange = (categoryIds: string[]) => {
    const newCategories: ReleaseCategoryItem[] = categoryIds.flatMap((id) => {
      const category = allCategories?.find((item) => item.id === id);
      return category ? [{ id: category.id, name: category.name, slug: category.slug ?? '' }] : [];
    });

    onCategoriesChange(newCategories);
    setCategories.mutate(categoryIds);
  };

  const handleGenresChange = (genreIds: string[]) => {
    const newGenres: ReleaseGenreItem[] = genreIds.flatMap((id) => {
      const genre = allGenres?.find((g) => g.id === id);
      return genre ? [{ id: genre.id, name: genre.name, slug: genre.slug }] : [];
    });

    onGenresChange(newGenres);
    setGenres.mutate(genreIds);
  };

  const handleStylesChange = (styleIds: string[]) => {
    const newStyles: ReleaseStyleItem[] = styleIds.flatMap((id) => {
      const style = allStyles?.find((s) => s.id === id);
      return style ? [{ id: style.id, name: style.name, slug: style.slug }] : [];
    });

    onStylesChange(newStyles);
    setStyles.mutate(styleIds);
  };

  const handleFormatsChange = (formatIds: string[]) => {
    const newFormats: ReleaseFormatItem[] = formatIds.flatMap((id) => {
      const format = allFormats?.find((f) => f.id === id);
      return format ? [{ id: format.id, name: format.name, slug: format.slug, format_description: null }] : [];
    });

    onFormatsChange(newFormats);
    setFormats.mutate(formatIds);
  };

  const categoryOptions = useMemo(
    () => allCategories?.map((category) => ({ value: category.id, label: category.name })) || [],
    [allCategories],
  );

  const genreOptions = useMemo(() => allGenres?.map((g) => ({ value: g.id, label: g.name })) || [], [allGenres]);

  const styleOptions = useMemo(() => allStyles?.map((s) => ({ value: s.id, label: s.name })) || [], [allStyles]);

  const formatOptions = useMemo(() => allFormats?.map((f) => ({ value: f.id, label: f.name })) || [], [allFormats]);

  return (
    <SectionCard>
      <Stack>
        <SectionHeader title={t('title')} />

        <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md" verticalSpacing="md">
          <MultiSelect
            id={idPrefix ? `${idPrefix}-categories` : undefined}
            label={tCommon('entities.categories')}
            placeholder={tCategorySelector('placeholder')}
            data={categoryOptions}
            value={categories.map((category) => category.id)}
            onChange={handleCategoriesChange}
            searchable
            clearable
          />

          <MultiSelect
            id={idPrefix ? `${idPrefix}-genres` : undefined}
            label={tCommon('entities.genres')}
            placeholder={t('placeholders.genres')}
            data={genreOptions}
            value={genres.map((g) => g.id)}
            onChange={handleGenresChange}
            searchable
            clearable
          />

          <MultiSelect
            id={idPrefix ? `${idPrefix}-styles` : undefined}
            label={tCommon('entities.styles')}
            placeholder={t('placeholders.styles')}
            data={styleOptions}
            value={styles.map((s) => s.id)}
            onChange={handleStylesChange}
            searchable
            clearable
          />

          <MultiSelect
            id={idPrefix ? `${idPrefix}-formats` : undefined}
            label={tCommon('entities.formats')}
            placeholder={t('placeholders.formats')}
            data={formatOptions}
            value={formats.map((f) => f.id)}
            onChange={handleFormatsChange}
            searchable
            clearable
          />
        </SimpleGrid>
      </Stack>
    </SectionCard>
  );
}
