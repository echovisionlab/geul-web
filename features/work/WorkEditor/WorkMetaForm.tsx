'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SimpleGrid, Stack, Text } from '@mantine/core';
import { MonthPickerInput, type DateValue } from '@mantine/dates';
import { TextInput, NativeSelect, Switch, TagsInput } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { WORK_TYPE_LABELS, WORK_TYPES, WorkType } from '@/lib/types/work/model';
import { normalizeStringList, STRING_LIST_SPLIT_CHARS } from './stringList';

interface WorkMetaFormProps {
  workId: string;
  type: WorkType;
  year: number;
  month: number;
  untilYear: number | null;
  untilMonth: number | null;
  isPresent: boolean;
  metadata: Record<string, unknown>;
  featured: boolean;
  disabled?: boolean;
  onChange: (
    updates: Partial<{
      type: WorkType;
      year: number;
      month: number;
      untilYear: number | null;
      untilMonth: number | null;
      isPresent: boolean;
      metadata: Record<string, unknown>;
      featured: boolean;
    }>,
  ) => void;
}

const WORK_TYPE_OPTIONS = WORK_TYPES.map((type) => ({
  value: type,
  label: WORK_TYPE_LABELS[type],
}));
const EMPTY_STRING_ARRAY: string[] = [];

function toMonthDate(year: number, month: number): DateValue {
  if (!year || !month) {
    return null;
  }
  return new Date(year, month - 1, 1);
}

function parseMonthValue(value: DateValue): { year: number; month: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
    };
  }

  if (typeof value === 'string' && value.length > 0) {
    const isoMatch = value.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
        return { year, month };
      }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
    };
  }

  return null;
}

function comparePeriod(a: { year: number; month: number }, b: { year: number; month: number }) {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  return a.month - b.month;
}

export function WorkMetaForm({
  workId,
  type,
  year,
  month,
  untilYear,
  untilMonth,
  isPresent,
  metadata,
  featured,
  disabled = false,
  onChange,
}: WorkMetaFormProps) {
  const t = useTranslations('workEditor.metaForm');
  const tCommonLabels = useTranslations('common.labels');
  const tWorkTypes = useTranslations('works.types');
  const workTypeOptions = useMemo(
    () =>
      WORK_TYPE_OPTIONS.map((option) => ({
        ...option,
        label: tWorkTypes(option.value),
      })),
    [tWorkTypes],
  );
  const handleMetadataChange = (updates: Record<string, unknown>) => {
    onChange({ metadata: { ...metadata, ...updates } });
  };

  const handlePeriodChange = (value: DateValue) => {
    const nextPeriod = parseMonthValue(value);
    if (!nextPeriod) {
      return;
    }
    const nextYear = nextPeriod.year;
    const nextMonth = nextPeriod.month;
    const updates: Partial<{
      year: number;
      month: number;
      untilYear: number | null;
      untilMonth: number | null;
    }> = {
      year: nextYear,
      month: nextMonth,
    };

    if (!isPresent) {
      const hasUntil = untilYear !== null && untilMonth !== null;
      if (
        !hasUntil ||
        comparePeriod(
          { year: untilYear ?? nextYear, month: untilMonth ?? nextMonth },
          {
            year: nextYear,
            month: nextMonth,
          },
        ) < 0
      ) {
        updates.untilYear = nextYear;
        updates.untilMonth = nextMonth;
      }
    }

    onChange(updates);
  };

  const handleUntilChange = (value: DateValue) => {
    const nextPeriod = parseMonthValue(value);
    if (!nextPeriod) {
      return;
    }
    onChange({
      untilYear: nextPeriod.year,
      untilMonth: nextPeriod.month,
      isPresent: false,
    });
  };

  const handlePresentChange = (checked: boolean) => {
    onChange(
      checked
        ? { isPresent: true, untilYear: null, untilMonth: null }
        : { isPresent: false, untilYear: year, untilMonth: month },
    );
  };

  return (
    <fieldset disabled={disabled} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
      <SectionCard>
        <Stack gap="md">
          <SectionHeader title={t('sections.workDetails')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              id={`work-${workId}-type`}
              label={tCommonLabels('type')}
              data={workTypeOptions}
              value={type}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (value) {
                  onChange({ type: value as WorkType });
                }
              }}
            />
            <MonthPickerInput
              id={`work-${workId}-period-start`}
              label={t('labels.from')}
              description={tCommonLabels('required')}
              placeholder={t('placeholders.selectYearMonth')}
              value={toMonthDate(year, month)}
              onChange={handlePeriodChange}
              valueFormat="YYYY.MM"
              clearable={false}
            />
            <MonthPickerInput
              id={`work-${workId}-period-end`}
              label={t('labels.until')}
              description={isPresent ? t('descriptions.untilCleared') : t('descriptions.untilRequired')}
              placeholder={isPresent ? t('placeholders.untilDisabled') : t('placeholders.selectYearMonth')}
              value={untilYear && untilMonth ? toMonthDate(untilYear, untilMonth) : null}
              onChange={handleUntilChange}
              valueFormat="YYYY.MM"
              clearable={false}
              disabled={isPresent}
            />
          </SimpleGrid>

          <Switch
            id={`work-${workId}-is-present`}
            label={t('labels.ongoing')}
            description={t('descriptions.ongoing')}
            checked={isPresent}
            onChange={(e) => handlePresentChange(e.currentTarget.checked)}
          />

          <Switch
            id={`work-${workId}-featured`}
            label={t('labels.featured')}
            description={t('descriptions.featured')}
            checked={featured}
            onChange={(e) => onChange({ featured: e.currentTarget.checked })}
          />
          {type === 'music_project' && (
            <MusicProjectFields workId={workId} metadata={metadata} onChange={handleMetadataChange} />
          )}
          {type === 'portfolio' && (
            <PortfolioFields workId={workId} metadata={metadata} onChange={handleMetadataChange} />
          )}
          {type === 'article' && <ArticleFields workId={workId} metadata={metadata} onChange={handleMetadataChange} />}
          {type === 'contribution' && (
            <ContributionFields workId={workId} metadata={metadata} onChange={handleMetadataChange} />
          )}
        </Stack>
      </SectionCard>
    </fieldset>
  );
}

function MusicProjectFields({
  workId,
  metadata,
  onChange,
}: {
  workId: string;
  metadata: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const t = useTranslations('workEditor.metaForm.musicProject');
  const tCommonLabels = useTranslations('common.labels');
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed" fw={500}>
        {t('title')}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          id={`work-${workId}-release-date`}
          label={tCommonLabels('releaseDate')}
          type="date"
          value={(metadata.releaseDate as string) || ''}
          onChange={(e) => onChange({ releaseDate: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-spotify-url`}
          label={t('fields.spotifyUrl')}
          placeholder="https://open.spotify.com/..."
          value={(metadata.spotifyUrl as string) || ''}
          onChange={(e) => onChange({ spotifyUrl: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-bandcamp-url`}
          label={t('fields.bandcampUrl')}
          placeholder="https://bandcamp.com/..."
          value={(metadata.bandcampUrl as string) || ''}
          onChange={(e) => onChange({ bandcampUrl: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-soundcloud-url`}
          label={t('fields.soundcloudUrl')}
          placeholder="https://soundcloud.com/..."
          value={(metadata.soundcloudUrl as string) || ''}
          onChange={(e) => onChange({ soundcloudUrl: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-youtube-url`}
          label={t('fields.youtubeUrl')}
          placeholder="https://youtube.com/..."
          value={(metadata.youtubeUrl as string) || ''}
          onChange={(e) => onChange({ youtubeUrl: e.currentTarget.value })}
        />
      </SimpleGrid>
    </Stack>
  );
}

function PortfolioFields({
  workId,
  metadata,
  onChange,
}: {
  workId: string;
  metadata: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const t = useTranslations('workEditor.metaForm.portfolio');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const technologies = useMemo(() => {
    return normalizeStringList(
      Array.isArray(metadata.technologies) ? (metadata.technologies as string[]) : EMPTY_STRING_ARRAY,
    );
  }, [metadata.technologies]);

  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed" fw={500}>
        {t('title')}
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          id={`work-${workId}-project-url`}
          label={t('fields.projectUrl')}
          placeholder={tCommonPlaceholders('website')}
          value={(metadata.projectUrl as string) || ''}
          onChange={(e) => onChange({ projectUrl: e.currentTarget.value })}
        />
      </SimpleGrid>
      <TagsInput
        id={`work-${workId}-technologies`}
        label={t('fields.technologies')}
        placeholder={t('placeholders.addTechnology')}
        value={technologies}
        splitChars={STRING_LIST_SPLIT_CHARS}
        onChange={(value) =>
          onChange({
            technologies: normalizeStringList(value),
          })
        }
      />
    </Stack>
  );
}

function ArticleFields({
  workId,
  metadata,
  onChange,
}: {
  workId: string;
  metadata: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const t = useTranslations('workEditor.metaForm.article');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed" fw={500}>
        {t('title')}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          id={`work-${workId}-external-url`}
          label={t('fields.externalUrl')}
          placeholder={tCommonPlaceholders('website')}
          value={(metadata.externalUrl as string) || ''}
          onChange={(e) => onChange({ externalUrl: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-publication`}
          label={t('fields.publication')}
          placeholder={t('placeholders.publication')}
          value={(metadata.publication as string) || ''}
          onChange={(e) => onChange({ publication: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-published-date`}
          label={t('fields.publishedDate')}
          type="date"
          value={(metadata.publishedDate as string) || ''}
          onChange={(e) => onChange({ publishedDate: e.currentTarget.value })}
        />
      </SimpleGrid>
    </Stack>
  );
}

function ContributionFields({
  workId,
  metadata,
  onChange,
}: {
  workId: string;
  metadata: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const t = useTranslations('workEditor.metaForm.contribution');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed" fw={500}>
        {t('title')}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          id={`work-${workId}-project-name`}
          label={t('fields.projectName')}
          placeholder={t('placeholders.projectName')}
          value={(metadata.projectName as string) || ''}
          onChange={(e) => onChange({ projectName: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-role`}
          label={tCommonLabels('role')}
          placeholder={t('placeholders.role')}
          value={(metadata.role as string) || ''}
          onChange={(e) => onChange({ role: e.currentTarget.value })}
        />
        <TextInput
          id={`work-${workId}-url`}
          label={tCommonLabels('url')}
          placeholder={tCommonPlaceholders('website')}
          value={(metadata.url as string) || ''}
          onChange={(e) => onChange({ url: e.currentTarget.value })}
        />
      </SimpleGrid>
    </Stack>
  );
}
