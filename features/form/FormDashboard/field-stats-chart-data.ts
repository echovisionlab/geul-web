import type { ChartDatum, ChartKind } from '@/components/core/Chart';
import type { FieldStats } from '@/lib/types/form/model';
export type FieldChartType = ChartKind | 'table';
export const fieldChartOptions: Record<string, readonly FieldChartType[]> = {
  select: ['donut', 'pie', 'bar-horizontal', 'bar-vertical', 'radar', 'table'],
  multiselect: ['bar-horizontal', 'bar-vertical', 'radar', 'table'],
  checkbox: ['donut', 'pie', 'bar-horizontal', 'table'],
  switch: ['donut', 'pie', 'bar-horizontal', 'table'],
  date: ['area', 'line', 'bar-vertical', 'table'],
  number: ['histogram', 'bar-vertical', 'table'],
  default: ['bar-horizontal', 'table'],
};
/** Preserve category identities, date keys and histogram bounds; formatting belongs to the locale. */
export function fieldChartRows(stat: FieldStats, format: (value: number) => string, empty: string): ChartDatum[] {
  if ('distribution' in stat) {
    return stat.distribution.map((item) => ({ name: item.value || empty, value: item.count }));
  }
  if ('dateDistribution' in stat) {
    return stat.dateDistribution.map((item) => ({ name: item.date, value: item.count }));
  }
  const size = stat.histogram.length > 1 ? stat.histogram[1].bucket - stat.histogram[0].bucket : 1;
  return stat.histogram.map((item) => ({
    name: `${format(item.bucket)} – ${format(item.bucket + size)}`,
    value: item.count,
  }));
}
