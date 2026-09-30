type SubmissionDateRangeValue = [Date | string | null, Date | string | null];

function startOfLocalDay(value: Date | string): Date | undefined {
  let year: number;
  let month: number;
  let day: number;

  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return undefined;
    }

    year = Number(match[1]);
    month = Number(match[2]) - 1;
    day = Number(match[3]);
  } else {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    year = value.getFullYear();
    month = value.getMonth();
    day = value.getDate();
  }

  const result = new Date(0);
  result.setFullYear(year, month, day);
  result.setHours(0, 0, 0, 0);

  if (result.getFullYear() !== year || result.getMonth() !== month || result.getDate() !== day) {
    return undefined;
  }

  return result;
}

/** Converts picker calendar days into inclusive-start/exclusive-end local-midnight bounds. */
export function getSubmissionDateRangeBounds(range: SubmissionDateRangeValue): {
  dateFrom?: string;
  dateTo?: string;
} {
  const [from, through] = range;
  const start = from ? startOfLocalDay(from) : undefined;
  const end = through ? startOfLocalDay(through) : undefined;

  if (end) {
    end.setDate(end.getDate() + 1);
  }

  return {
    dateFrom: start?.toISOString(),
    dateTo: end?.toISOString(),
  };
}
