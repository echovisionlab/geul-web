'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { Box, Input, SimpleGrid, type BoxProps } from '@mantine/core';
import {
  DatePickerInput as MantineDatePickerInput,
  DatesProvider,
  TimePicker as MantineTimePicker,
} from '@mantine/dates';
import { useMediaQuery, useUncontrolled } from '@mantine/hooks';
import 'dayjs/locale/ar';
import 'dayjs/locale/de';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/fr';
import 'dayjs/locale/id';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/nl';
import 'dayjs/locale/pl';
import 'dayjs/locale/pt';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/ru';
import 'dayjs/locale/th';
import 'dayjs/locale/tr';
import 'dayjs/locale/vi';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';

export interface DateTimeValue {
  date: string | null;
  time: string;
}

export interface DateTimeInputProps extends BoxProps {
  locale: string;
  dateLabel: ReactNode;
  timeLabel: ReactNode;
  previousLabel: string;
  nextLabel: string;
  hoursLabel: string;
  minutesLabel: string;
  value?: DateTimeValue;
  defaultValue?: DateTimeValue;
  onChange?: (value: DateTimeValue) => void;
  minDate?: DateTimeValue;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
}

const EMPTY_DATE_TIME_VALUE: DateTimeValue = { date: null, time: '' };
const DAYJS_LOCALES = new Set([
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'id',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt',
  'pt-br',
  'ru',
  'th',
  'tr',
  'vi',
  'zh-cn',
  'zh-tw',
]);

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function datePart(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateToDateTimeValue(date: Date): DateTimeValue {
  return {
    date: datePart(date),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function dateTimeValueToDate(value: DateTimeValue | null | undefined): Date | null {
  if (!value?.date || !value.time) {
    return null;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.time);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const [, hour, minute, second = '0'] = timeMatch;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), 0);

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute) ||
    date.getSeconds() !== Number(second)
  ) {
    return null;
  }

  return date;
}

function resolveDayjsLocale(locale: string): string {
  const normalized = locale.trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'es-419' || normalized.startsWith('es-')) {
    return 'es';
  }
  if (normalized === 'pt-pt') {
    return 'pt';
  }
  if (normalized === 'pt' || normalized.startsWith('pt-')) {
    return 'pt-br';
  }
  if (normalized === 'zh' || normalized.includes('hans') || normalized === 'zh-cn') {
    return 'zh-cn';
  }
  if (normalized.includes('hant') || ['zh-tw', 'zh-hk', 'zh-mo'].includes(normalized)) {
    return 'zh-tw';
  }
  const language = normalized.split('-')[0];
  return DAYJS_LOCALES.has(language) ? language : 'en';
}

function resolveFirstDayOfWeek(locale: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  try {
    const localeWithWeekInfo = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = localeWithWeekInfo.getWeekInfo?.().firstDay ?? localeWithWeekInfo.weekInfo?.firstDay;
    if (firstDay !== undefined) {
      return (firstDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
  } catch {
    // Invalid locale input falls back to Monday below.
  }
  return 1;
}

function normalizeDateValue(value: string | Date | null): string | null {
  return value instanceof Date ? datePart(value) : value;
}

function dateValueToLocalDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return value;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDateForLocale(value: string | Date, locale: string): string {
  const date = dateValueToLocalDate(value);
  if (!date) {
    return String(value);
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

function formatMonthForLocale(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) {
    return value;
  }
  const [, year, month] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long' }).format(date);
  }
}

export function DateTimeInput({
  locale,
  dateLabel,
  timeLabel,
  previousLabel,
  nextLabel,
  hoursLabel,
  minutesLabel,
  value,
  defaultValue,
  onChange,
  minDate,
  error,
  required,
  disabled,
  ...rootProps
}: DateTimeInputProps) {
  const useModal = Boolean(useMediaQuery('(max-width: 36em)'));
  const errorId = useId();
  const dayjsLocale = resolveDayjsLocale(locale);
  const providerSettings = useMemo(
    () => ({ locale: dayjsLocale, firstDayOfWeek: resolveFirstDayOfWeek(locale) }),
    [dayjsLocale, locale],
  );
  const [currentValue, setCurrentValue] = useUncontrolled<DateTimeValue>({
    value,
    defaultValue,
    finalValue: EMPTY_DATE_TIME_VALUE,
    onChange,
  });
  const describedBy = error ? errorId : undefined;

  return (
    <DatesProvider settings={providerSettings}>
      <Box {...rootProps}>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <MantineDatePickerInput
            label={dateLabel}
            value={currentValue.date}
            onChange={(nextDate) => setCurrentValue({ ...currentValue, date: normalizeDateValue(nextDate) })}
            minDate={minDate?.date ?? undefined}
            required={required}
            disabled={disabled}
            clearable
            dropdownType={useModal ? 'modal' : 'popover'}
            modalProps={{ centered: true }}
            popoverProps={{
              withinPortal: true,
              middlewares: { flip: true, shift: true },
            }}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
            monthLabelFormat={(month) => formatMonthForLocale(month, locale)}
            valueFormatter={({ date }) => (date && !Array.isArray(date) ? formatDateForLocale(date, locale) : '')}
            aria-describedby={describedBy}
          />
          <MantineTimePicker
            label={timeLabel}
            value={currentValue.time}
            onChange={(time) => setCurrentValue({ ...currentValue, time })}
            format="24h"
            required={required}
            disabled={disabled}
            clearable
            withDropdown={false}
            hoursInputLabel={hoursLabel}
            minutesInputLabel={minutesLabel}
            hoursInputProps={{ 'aria-describedby': describedBy }}
            minutesInputProps={{ 'aria-describedby': describedBy }}
          />
        </SimpleGrid>
        {error ? (
          <Input.Error id={errorId} mt="xs">
            {error}
          </Input.Error>
        ) : null}
      </Box>
    </DatesProvider>
  );
}
