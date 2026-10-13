'use client';

import { useState } from 'react';
import { parseDate, parseDateTime, parseTime, type CalendarDate, type CalendarDateTime } from '@internationalized/date';
import { useLocale } from 'react-aria';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput as AriaDateInput,
  DatePicker,
  DateRangePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  RangeCalendar,
  TimeField,
} from 'react-aria-components';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import { fieldAccessibility, inputAttributes, type InputBaseProps } from './input-contract';
import { useCoreInputLabels } from './input-labels';
import classes from './Input.module.css';
import { InputCalendarGlyph, InputClearGlyph } from './InputGlyphs';

/** Calendar values are timezone-free ISO strings. Date objects are interpreted in their local calendar. */
export type DateValue = string | null;
export type DatesRangeValue = [DateValue, DateValue];
type DateSource = string | Date | null;
type CalendarInputBase = Omit<InputBaseProps, 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'>;
export interface DateInputProps extends CalendarInputBase {
  value?: DateSource;
  defaultValue?: DateSource;
  onChange?: (value: DateValue) => void;
  minDate?: DateSource;
  maxDate?: DateSource;
  clearable?: boolean;
  placeholder?: string;
}
export type DateTimePickerProps = DateInputProps;
export type MonthPickerInputProps = DateInputProps;
export interface DateRangeInputProps extends CalendarInputBase {
  value?: DatesRangeValue;
  defaultValue?: DatesRangeValue;
  onChange?: (value: DatesRangeValue) => void;
  minDate?: DateSource;
  maxDate?: DateSource;
  clearable?: boolean;
  placeholder?: string;
}
export interface TimePickerProps extends CalendarInputBase {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  withSeconds?: boolean;
  clearable?: boolean;
  hoursInputLabel?: string;
  minutesInputLabel?: string;
  secondsInputLabel?: string;
}
function pad(value: number) {
  return String(value).padStart(2, '0');
}
function source(value: DateSource | undefined, time = false) {
  if (!(value instanceof Date)) {
    return value || null;
  }
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return time ? `${date}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}` : date;
}
function calendarValue(value: DateSource | undefined, time = false): CalendarDate | CalendarDateTime | null {
  try {
    const raw = source(value, time);
    return raw ? (time ? parseDateTime(raw.replace(' ', 'T')) : parseDate(raw.slice(0, 10))) : null;
  } catch {
    return null;
  }
}
function CalendarSurface({ range = false }: { range?: boolean }) {
  const content = (
    <>
      <header className={classes.calendarHeader}>
        <Button slot="previous" className={classes.accessory}>
          ‹
        </Button>
        <Heading className={classes.label} />
        <Button slot="next" className={classes.accessory}>
          ›
        </Button>
      </header>
      <CalendarGrid>{(date) => <CalendarCell date={date} className={classes.calendarCell} />}</CalendarGrid>
    </>
  );
  return (
    <Popover className={classes.popover}>
      <Dialog className={classes.calendarDialog}>
        {range ? (
          <RangeCalendar className={classes.calendar}>{content}</RangeCalendar>
        ) : (
          <Calendar className={classes.calendar}>{content}</Calendar>
        )}
      </Dialog>
    </Popover>
  );
}
function CalendarField(props: DateInputProps & { mode: 'date' | 'datetime' | 'month' }) {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const { locale } = useLocale();
  const time = props.mode === 'datetime';
  const [local, setLocal] = useState<DateSource>(props.defaultValue ?? null);
  const value = props.value === undefined ? local : props.value;
  const update = (next: DateValue) => {
    if (props.disabled || props.readOnly) {
      return;
    }
    setLocal(next);
    props.onChange?.(next);
  };
  const monthOrder = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric' })
    .formatToParts(new Date(2000, 0, 1))
    .filter((part) => part.type === 'year' || part.type === 'month')
    .map((part) => part.type);
  const convert = (value: CalendarDate | CalendarDateTime | null) =>
    value
      ? props.mode === 'month'
        ? `${value.year}-${pad(value.month)}-01`
        : value.toString().replace('T', ' ')
      : null;
  return (
    <DatePicker
      id={props.id}
      {...inputAttributes(props)}
      {...fieldAccessibility(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={calendarValue(value, time)}

      onChange={(value) => update(convert(value))}
      minValue={calendarValue(props.minDate, time) ?? undefined}
      maxValue={calendarValue(props.maxDate, time) ?? undefined}
      granularity={time ? 'minute' : 'day'}
      hourCycle={24}
    >
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        <AriaDateInput className={classes.dateInput}>
          {(segment) =>
            props.mode === 'month' ? (
              segment.type === 'month' || segment.type === 'year' ? (
                <>
                  {segment.type !== monthOrder[0] ? <span aria-hidden>/</span> : null}
                  <DateSegment segment={segment} className={classes.dateSegment} />
                </>
              ) : (
                <></>
              )
            ) : (
              <DateSegment segment={segment} className={classes.dateSegment} />
            )
          }
        </AriaDateInput>
        {props.clearable ? (
          <Button
            slot={null}
            className={classes.accessory}
            aria-label={labels.clear}
            onPress={() => update(null)}
            isDisabled={props.disabled || props.readOnly}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
        <Button className={classes.accessory}>
          <InputCalendarGlyph />
        </Button>
      </Group>
      <InputHelp {...props} />
      <CalendarSurface />
    </DatePicker>
  );
}
export function DateInput(props: DateInputProps) {
  return <CalendarField {...props} mode="date" />;
}
export function DateTimePicker(props: DateTimePickerProps) {
  return <CalendarField {...props} mode="datetime" />;
}
export function MonthPickerInput(props: MonthPickerInputProps) {
  return <CalendarField {...props} mode="month" />;
}
function dateRange(value: DatesRangeValue | undefined) {
  const start = calendarValue(value?.[0]);
  const end = calendarValue(value?.[1]);
  return start && end ? { start, end } : null;
}
export function DateRangeInput(props: DateRangeInputProps) {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const [local, setLocal] = useState<DatesRangeValue>(props.defaultValue ?? [null, null]);
  const value = props.value ?? local;
  const update = (next: DatesRangeValue) => {
    if (props.disabled || props.readOnly) {
      return;
    }
    setLocal(next);
    props.onChange?.(next);
  };
  return (
    <DateRangePicker
      id={props.id}
      {...inputAttributes(props)}
      {...fieldAccessibility(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={dateRange(value)}

      onChange={(value) => update(value ? [value.start.toString(), value.end.toString()] : [null, null])}
      minValue={calendarValue(props.minDate) ?? undefined}
      maxValue={calendarValue(props.maxDate) ?? undefined}
    >
      <InputLabel {...props} />
      <Group className={`${classes.wrapper} ${classes.dateRangeWrapper}`}>
        <AriaDateInput slot="start" className={classes.dateInput}>
          {(segment) => <DateSegment segment={segment} className={classes.dateSegment} />}
        </AriaDateInput>
        <span aria-hidden>–</span>
        <AriaDateInput slot="end" className={classes.dateInput}>
          {(segment) => <DateSegment segment={segment} className={classes.dateSegment} />}
        </AriaDateInput>
        {props.clearable ? (
          <Button
            slot={null}
            className={classes.accessory}
            aria-label={labels.clear}
            onPress={() => update([null, null])}
            isDisabled={props.disabled || props.readOnly}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
        <Button className={classes.accessory}>
          <InputCalendarGlyph />
        </Button>
      </Group>
      <InputHelp {...props} />
      <CalendarSurface range />
    </DateRangePicker>
  );
}
function timeValue(value: string | undefined) {
  try {
    return value ? parseTime(value) : null;
  } catch {
    return null;
  }
}
export function TimePicker(props: TimePickerProps) {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const [local, setLocal] = useState(props.defaultValue ?? '');
  const value = props.value ?? local;
  const update = (next: string) => {
    if (props.disabled || props.readOnly) {
      return;
    }
    setLocal(next);
    props.onChange?.(next);
  };
  return (
    <TimeField
      id={props.id}
      {...inputAttributes(props)}
      {...fieldAccessibility(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={timeValue(value)}

      onChange={(value) =>
        update(
          value ? `${pad(value.hour)}:${pad(value.minute)}${props.withSeconds ? `:${pad(value.second)}` : ''}` : '',
        )
      }
      granularity={props.withSeconds ? 'second' : 'minute'}
      hourCycle={24}
    >
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        <AriaDateInput className={classes.dateInput}>
          {(segment) => (
            <DateSegment
              segment={segment}
              className={classes.dateSegment}
              aria-label={
                segment.type === 'hour'
                  ? props.hoursInputLabel
                  : segment.type === 'minute'
                    ? props.minutesInputLabel
                    : segment.type === 'second'
                      ? props.secondsInputLabel
                      : undefined
              }
            />
          )}
        </AriaDateInput>
        {props.clearable ? (
          <Button
            slot={null}
            className={classes.accessory}
            aria-label={labels.clear}
            onPress={() => update('')}
            isDisabled={props.disabled || props.readOnly}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
      </Group>
      <InputHelp {...props} />
    </TimeField>
  );
}
