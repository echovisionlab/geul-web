'use client';

import { useId, useState, type ReactNode } from 'react';
import { parseDate, parseTime } from '@internationalized/date';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
  Text,
  TimeField,
} from 'react-aria-components';
import { inputAttributes, type InputBaseProps } from './input-contract';
import { inputPresentation, useToolbarInputPresentation } from './InputParts';
import classes from './Input.module.css';
import { InputCalendarGlyph } from './InputGlyphs';

export interface DateTimeValue {
  date: string | null;
  time: string;
}
export interface DateTimeInputProps extends Omit<
  InputBaseProps,
  'label' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'
> {
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
}
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

function safeDate(value: string | null | undefined) {
  try {
    return value ? parseDate(value) : null;
  } catch {
    return null;
  }
}
function safeTime(value: string) {
  try {
    return value ? parseTime(value) : null;
  } catch {
    return null;
  }
}
export function DateTimeInput(props: DateTimeInputProps) {
  const presentation = useToolbarInputPresentation(props);
  const errorId = `${useId()}-error`;
  const descriptionId = `${errorId}-description`;
  const errorDescription = props.error && typeof props.error !== 'boolean' ? errorId : undefined;
  const [uncontrolled, setValue] = useState<DateTimeValue>(props.defaultValue ?? { date: null, time: '' });
  const value = props.value ?? uncontrolled;
  const update = (next: DateTimeValue) => {
    setValue(next);
    props.onChange?.(next);
  };
  return (
    <I18nProvider locale={props.locale}>
      <div {...inputAttributes(props)} className={classes.dateTime} data-geul-input-size={presentation.size ?? 'sm'}>
        <DatePicker
          {...inputPresentation(presentation)}
          value={safeDate(value.date)}
          onChange={(date) => update({ ...value, date: date?.toString() ?? null })}
          minValue={safeDate(props.minDate?.date) ?? undefined}
          isRequired={props.required}
          isDisabled={props.disabled}
          isReadOnly={props.readOnly}
          isInvalid={Boolean(props.error)}
          validationBehavior="aria"
          aria-describedby={
            [props['aria-describedby'], errorDescription, props.description ? descriptionId : undefined]
              .filter(Boolean)
              .join(' ') || undefined
          }
        >
          <Label className={classes.label}>{props.dateLabel}</Label>
          <Group className={classes.wrapper}>
            <DateInput className={classes.dateInput}>
              {(segment) => <DateSegment segment={segment} className={classes.dateSegment} />}
            </DateInput>
            <Button className={classes.accessory}>
              <InputCalendarGlyph />
            </Button>
          </Group>
          <Popover className={classes.popover}>
            <Dialog className={classes.calendarDialog}>
              <Calendar className={classes.calendar}>
                <header className={classes.calendarHeader}>
                  <Button slot="previous" aria-label={props.previousLabel} className={classes.accessory}>
                    ‹
                  </Button>
                  <Heading className={classes.label} />
                  <Button slot="next" aria-label={props.nextLabel} className={classes.accessory}>
                    ›
                  </Button>
                </header>
                <CalendarGrid>{(date) => <CalendarCell date={date} className={classes.calendarCell} />}</CalendarGrid>
              </Calendar>
            </Dialog>
          </Popover>
        </DatePicker>
        <TimeField
          {...inputPresentation(presentation)}
          value={safeTime(value.time)}
          onChange={(time) =>
            update({
              ...value,
              time: time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '',
            })
          }
          hourCycle={24}
          granularity="minute"
          isRequired={props.required}
          isDisabled={props.disabled}
          isReadOnly={props.readOnly}
          isInvalid={Boolean(props.error)}
          validationBehavior="aria"
          aria-describedby={
            [props['aria-describedby'], errorDescription, props.description ? descriptionId : undefined]
              .filter(Boolean)
              .join(' ') || undefined
          }
        >
          <Label className={classes.label}>{props.timeLabel}</Label>
          <Group className={classes.wrapper}>
            <DateInput className={classes.dateInput}>
              {(segment) => (
                <DateSegment
                  segment={segment}
                  className={classes.dateSegment}
                  aria-label={
                    segment.type === 'hour'
                      ? props.hoursLabel
                      : segment.type === 'minute'
                        ? props.minutesLabel
                        : undefined
                  }
                />
              )}
            </DateInput>
          </Group>
        </TimeField>
        {props.description ? (
          <Text id={descriptionId} className={classes.description}>
            {props.description}
          </Text>
        ) : null}
        {props.error && typeof props.error !== 'boolean' ? (
          <Text id={errorId} className={classes.error}>
            {props.error}
          </Text>
        ) : null}
      </div>
    </I18nProvider>
  );
}
