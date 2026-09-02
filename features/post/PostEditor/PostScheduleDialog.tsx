'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { FormModal } from '@/components/core/Modal';
import {
  DateTimeInput,
  dateTimeValueToDate,
  dateToDateTimeValue,
  Select,
  type DateTimeValue,
} from '@/components/core/Input';
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
}

function initialLocalDate(instant: string | null | undefined, timeZone: string): DateTimeValue {
  if (instant) {
    return dateToDateTimeValue(instantToScheduleInput(new Date(instant), timeZone));
  }
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return dateToDateTimeValue(date);
}

export function PostScheduleDialog({
  opened,
  onClose,
  onSubmit,
  initialInstant,
  initialTimeZone,
  loading = false,
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
    const localWallTime = dateTimeValueToDate(localDate);
    if (!localWallTime || !timeZone) {
      return null;
    }
    try {
      const value = resolvePostSchedule(localWallTime, timeZone, locale);
      return value.instant.getTime() > Date.now() ? value : null;
    } catch {
      return null;
    }
  }, [localDate, locale, timeZone]);

  const handleSubmit = () => {
    const localWallTime = dateTimeValueToDate(localDate);
    if (!localWallTime || !timeZone) {
      setError(t('required'));
      return;
    }
    try {
      const value = resolvePostSchedule(localWallTime, timeZone, locale);
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
      submitDisabled={!resolution}
      size="standard"
    >
      <Stack gap="sm">
        <DateTimeInput
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
          minDate={dateToDateTimeValue(new Date())}
          error={error}
          required
        />
        <Select
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
          <Stack gap={2} data-testid="post-schedule-resolution">
            <Text size="sm">{t('result', { value: resolution.localLabel })}</Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {t('utcInstant', { value: resolution.utcLabel })}
            </Text>
            <Text size="xs" c="dimmed">
              {t('dstNotice')}
            </Text>
          </Stack>
        ) : null}
      </Stack>
    </FormModal>
  );
}
