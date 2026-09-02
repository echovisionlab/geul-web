export function formatWorkPeriodLabel(
  year: number,
  month: number,
  untilYear: number | null,
  untilMonth: number | null,
  isPresent: boolean,
): string {
  const fromLabel = `${year}.${String(month).padStart(2, '0')}`;
  if (isPresent) {
    return `${fromLabel} - Ongoing`;
  }
  if (untilYear === null || untilMonth === null) {
    return fromLabel;
  }

  const untilLabel = `${untilYear}.${String(untilMonth).padStart(2, '0')}`;
  if (untilLabel === fromLabel) {
    return fromLabel;
  }

  return `${fromLabel} - ${untilLabel}`;
}
