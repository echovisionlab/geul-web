export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function getZonedDateTimeParts(instant: Date, timeZone: string): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

export function instantToZonedDateTimeInput(instant: Date, timeZone: string): string {
  const parts = getZonedDateTimeParts(instant, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function inputParts(value: string | Date): ZonedDateTimeParts | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      hour: value.getHours(),
      minute: value.getMinutes(),
      second: value.getSeconds(),
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

export function zonedDateTimeInputToInstant(value: string | Date, timeZone: string): Date {
  const desired = inputParts(value);
  if (!desired) {
    throw new Error('Invalid date-time value.');
  }

  return zonedDateTimePartsToInstant(desired, timeZone);
}

export function zonedDateTimePartsToInstant(desired: ZonedDateTimeParts, timeZone: string): Date {
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
    0,
  );
  let candidate = new Date(desiredAsUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedDateTimeParts(candidate, timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      0,
    );
    candidate = new Date(candidate.getTime() + desiredAsUtc - actualAsUtc);
  }

  const resolved = getZonedDateTimeParts(candidate, timeZone);
  if (
    resolved.year !== desired.year ||
    resolved.month !== desired.month ||
    resolved.day !== desired.day ||
    resolved.hour !== desired.hour ||
    resolved.minute !== desired.minute ||
    resolved.second !== desired.second
  ) {
    throw new Error('The selected local time does not exist in this time zone.');
  }

  return candidate;
}
