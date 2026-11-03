'use client';
import { InputValidationGlyph } from '@/components/core/Input/InputGlyphs';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';
import { LayoutStack as DsLayoutStack, LayoutGrid as DsLayoutGrid } from '@/components/core/Layout';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
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
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
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
  onCategoriesMutationStart?: () => string | void;
  onCategoriesMutationSettled?: (succeeded: boolean) => void;
  onGenresMutationStart?: () => string | void;
  onGenresMutationSettled?: (succeeded: boolean) => void;
  onStylesMutationStart?: () => string | void;
  onStylesMutationSettled?: (succeeded: boolean) => void;
  onFormatsMutationStart?: () => string | void;
  onFormatsMutationSettled?: (succeeded: boolean) => void;
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
  onCategoriesMutationStart,
  onCategoriesMutationSettled,
  onGenresMutationStart,
  onGenresMutationSettled,
  onStylesMutationStart,
  onStylesMutationSettled,
  onFormatsMutationStart,
  onFormatsMutationSettled,
}: ReleaseTagsSectionProps) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tags');
  const tCategorySelector = useTranslations('postEditor.categorySelector');
  const allCategoriesQuery = useQuery({
    queryKey: ['category', 'list'],
    queryFn: () => listCategoriesAction().then(unwrapQueryResult),
  });
  const { data: allCategories } = allCategoriesQuery;
  const allGenresQuery = useQuery({
    queryKey: ['genre', 'list'],
    queryFn: () => listGenresAction().then(unwrapQueryResult),
  });
  const { data: allGenres } = allGenresQuery;
  const allStylesQuery = useQuery({
    queryKey: ['style', 'list'],
    queryFn: () => listStylesAction().then(unwrapQueryResult),
  });
  const { data: allStyles } = allStylesQuery;
  const allFormatsQuery = useQuery({
    queryKey: ['format', 'list'],
    queryFn: () => listFormatsAction().then(unwrapQueryResult),
  });
  const { data: allFormats } = allFormatsQuery;

  const setCategories = useMutation({
    mutationFn: async ({ ids, observed }: { ids: string[]; observed: string[] }) => {
      const editorOrigin = onCategoriesMutationStart?.() ?? undefined;
      return { ...(await setReleaseCategoriesAction(releaseId, ids, observed, editorOrigin)), editorOrigin };
    },
    onSettled: (result, error) => onCategoriesMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`, result.editorOrigin);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.categories') }),
        tone: 'positive',
      });
    },
  });

  const setGenres = useMutation({
    mutationFn: async ({ ids, observed }: { ids: string[]; observed: string[] }) => {
      const editorOrigin = onGenresMutationStart?.() ?? undefined;
      return { ...(await setReleaseGenresAction(releaseId, ids, observed, editorOrigin)), editorOrigin };
    },
    onSettled: (result, error) => onGenresMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`, result.editorOrigin);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.genres') }),
        tone: 'positive',
      });
    },
  });

  const setStyles = useMutation({
    mutationFn: async ({ ids, observed }: { ids: string[]; observed: string[] }) => {
      const editorOrigin = onStylesMutationStart?.() ?? undefined;
      return { ...(await setReleaseStylesAction(releaseId, ids, observed, editorOrigin)), editorOrigin };
    },
    onSettled: (result, error) => onStylesMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`, result.editorOrigin);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.styles') }),
        tone: 'positive',
      });
    },
  });

  const setFormats = useMutation({
    mutationFn: async ({
      nextFormats,
      observedFormats,
    }: {
      nextFormats: ReleaseFormatItem[];
      observedFormats: ReleaseFormatItem[];
    }) => {
      const editorOrigin = onFormatsMutationStart?.() ?? undefined;
      return {
        ...(await setReleaseFormatsAction(
          releaseId,
          nextFormats.map((format) => ({
            formatId: format.id,
            formatDescription: format.format_description ?? undefined,
          })),
          observedFormats.map((format) => ({
            formatId: format.id,
            formatDescription: format.format_description ?? undefined,
          })),
          editorOrigin,
        )),
        editorOrigin,
      };
    },
    onSettled: (result, error) => onFormatsMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`, result.editorOrigin);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.formats') }),
        tone: 'positive',
      });
    },
  });

  const handleCategoriesChange = (categoryIds: string[]) => {
    if (!canEdit) {
      return;
    }
    const newCategories: ReleaseCategoryItem[] = categoryIds.flatMap((id) => {
      const category = allCategories?.find((item) => item.id === id);
      return category ? [{ id: category.id, name: category.name, slug: category.slug ?? '' }] : [];
    });

    onCategoriesChange(newCategories);
    setCategories.mutate({ ids: categoryIds, observed: categories.map((item) => item.id) });
  };

  const handleGenresChange = (genreIds: string[]) => {
    if (!canEdit) {
      return;
    }
    const newGenres: ReleaseGenreItem[] = genreIds.flatMap((id) => {
      const genre = allGenres?.find((g) => g.id === id);
      return genre ? [{ id: genre.id, name: genre.name, slug: genre.slug }] : [];
    });

    onGenresChange(newGenres);
    setGenres.mutate({ ids: genreIds, observed: genres.map((item) => item.id) });
  };

  const handleStylesChange = (styleIds: string[]) => {
    if (!canEdit) {
      return;
    }
    const newStyles: ReleaseStyleItem[] = styleIds.flatMap((id) => {
      const style = allStyles?.find((s) => s.id === id);
      return style ? [{ id: style.id, name: style.name, slug: style.slug }] : [];
    });

    onStylesChange(newStyles);
    setStyles.mutate({ ids: styleIds, observed: styles.map((item) => item.id) });
  };

  const handleFormatsChange = (formatIds: string[]) => {
    if (!canEdit) {
      return;
    }
    const newFormats: ReleaseFormatItem[] = formatIds.flatMap((id) => {
      const format = allFormats?.find((f) => f.id === id);
      const previous = formats.find((item) => item.id === id);
      return format
        ? [
            {
              id: format.id,
              name: format.name,
              slug: format.slug,
              format_description: previous?.format_description ?? null,
            },
          ]
        : [];
    });

    onFormatsChange(newFormats);
    setFormats.mutate({ nextFormats: newFormats, observedFormats: formats });
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
      <QueryErrorAlert queries={[allCategoriesQuery, allGenresQuery, allStylesQuery, allFormatsQuery]} />
      <DsLayoutStack>
        <SectionHeader title={t('title')} />

        <DsLayoutGrid columns={{ base: 1, md: 2, xl: 4 }} gap="md" rowGap="md">
          <MultiSelect
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-categories` : undefined}
            label={tCommon('entities.categories')}
            placeholder={tCategorySelector('placeholder')}
            aria-busy={allCategoriesQuery.isFetching || undefined}
            rightSection={allCategoriesQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
            data={categoryOptions}
            value={categories.map((category) => category.id)}
            onChange={handleCategoriesChange}
            searchable
            clearable
          />

          <MultiSelect
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-genres` : undefined}
            label={tCommon('entities.genres')}
            placeholder={t('placeholders.genres')}
            aria-busy={allGenresQuery.isFetching || undefined}
            rightSection={allGenresQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
            data={genreOptions}
            value={genres.map((g) => g.id)}
            onChange={handleGenresChange}
            searchable
            clearable
          />

          <MultiSelect
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-styles` : undefined}
            label={tCommon('entities.styles')}
            placeholder={t('placeholders.styles')}
            aria-busy={allStylesQuery.isFetching || undefined}
            rightSection={allStylesQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
            data={styleOptions}
            value={styles.map((s) => s.id)}
            onChange={handleStylesChange}
            searchable
            clearable
          />

          <MultiSelect
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-formats` : undefined}
            label={tCommon('entities.formats')}
            placeholder={t('placeholders.formats')}
            aria-busy={allFormatsQuery.isFetching || undefined}
            rightSection={allFormatsQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
            data={formatOptions}
            value={formats.map((f) => f.id)}
            onChange={handleFormatsChange}
            searchable
            clearable
          />
        </DsLayoutGrid>
      </DsLayoutStack>
    </SectionCard>
  );
}
