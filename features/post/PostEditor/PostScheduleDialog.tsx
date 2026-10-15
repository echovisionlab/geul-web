'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { FormModal } from '@/components/core/Modal';
import { DateTimeInput, type DateTimeValue } from '@/components/core/Input/DateTimeInput';
import { Select } from '@/components/core/Input';
import {
  getIanaTimeZoneOptions,
  instantToScheduleInput,
  resolvePostSchedule,
  type PostScheduleResolution,
} from './post-schedule';
import { useRequestTimeZone } from '@/lib/providers/RequestTimeZoneProvider';

export interface PostScheduleDialogProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (schedule: PostScheduleResolution) => void;
  initialInstant?: string | null;
  initialTimeZone?: string | null;
  loading?: boolean;
  readOnly?: boolean;
}

function initialLocalDate(instant: string | null | undefined, timeZone: string): DateTimeValue {
  if (instant) {
    return instantToScheduleInput(new Date(instant), timeZone);
  }
  return instantToScheduleInput(new Date(Date.now() + 60 * 60 * 1000), timeZone);
}

export function PostScheduleDialog({
  opened,
  onClose,
  onSubmit,
  initialInstant,
  initialTimeZone,
  loading = false,
  readOnly = false,
}: PostScheduleDialogProps) {
  const locale = useLocale();
  const t = useTranslations('postEditor.schedule');
  const tActions = useTranslations('common.actions');
  const tLabels = useTranslations('common.labels');
  const requestTimeZone = useRequestTimeZone();
  const timeZoneOptions = useMemo(() => getIanaTimeZoneOptions(requestTimeZone), [requestTimeZone]);
  const startingZone = initialTimeZone || requestTimeZone;
  const [timeZone, setTimeZone] = useState(startingZone);
  const [localDate, setLocalDate] = useState<DateTimeValue>(() => initialLocalDate(initialInstant, startingZone));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    const nextZone = initialTimeZone || requestTimeZone;
    setTimeZone(nextZone);
    setLocalDate(initialLocalDate(initialInstant, nextZone));
    setError(null);
  }, [initialInstant, initialTimeZone, opened, requestTimeZone]);

  const resolution = useMemo(() => {
    if (!localDate.date || !localDate.time || !timeZone) {
      return null;
    }
    try {
      const value = resolvePostSchedule(localDate, timeZone, locale);
      return value.instant.getTime() > Date.now() ? value : null;
    } catch {
      return null;
    }
  }, [localDate, locale, timeZone]);

  const handleSubmit = () => {
    if (readOnly) {
      return;
    }
    if (!localDate.date || !localDate.time || !timeZone) {
      setError(t('required'));
      return;
    }
    try {
      const value = resolvePostSchedule(localDate, timeZone, locale);
      if (value.instant.getTime() <= Date.now()) {
        setError(t('futureRequired'));
        return;
      }
      setError(null);
      onSubmit(value);
    } catch {
      setError(t('invalidLocalTime'));
    }
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={initialInstant ? t('rescheduleTitle') : t('title')}
      submitLabel={initialInstant ? t('reschedule') : t('schedule')}
      cancelLabel={tActions('cancel')}
      closeLabel={tActions('close')}
      loading={loading}
      submitDisabled={readOnly || !resolution}
      size="standard"
    >
      <DsLayoutStack gap="sm">
        <DateTimeInput
          disabled={readOnly}
          locale={locale}
          nextLabel={t('nextPeriod')}
          previousLabel={t('previousPeriod')}
          dateLabel={t('date')}
          timeLabel={t('time')}
          hoursLabel={tLabels('hours')}
          minutesLabel={tLabels('minutes')}
          value={localDate}
          onChange={(value) => {
            setLocalDate(value);
            setError(null);
          }}
          minDate={instantToScheduleInput(new Date(Date.now()), timeZone)}
          error={error}
          required
        />
        <Select
          disabled={readOnly}
          label={t('timeZone')}
          value={timeZone}
          onChange={(value) => {
            if (value) {
              setTimeZone(value);
              setError(null);
            }
          }}
          data={timeZoneOptions}
          searchable
          allowDeselect={false}
        />
        {resolution ? (
          <DsLayoutStack gap="xxs" data-testid="post-schedule-resolution">
            <DsText size="sm">{t('result', { value: resolution.localLabel })}</DsText>
            <DsText size="xs" tone="secondary" font="mono">
              {t('utcInstant', { value: resolution.utcLabel })}
            </DsText>
            <DsText size="xs" tone="secondary">
              {t('dstNotice')}
            </DsText>
          </DsLayoutStack>
        ) : null}
      </DsLayoutStack>
    </FormModal>
  );
}
