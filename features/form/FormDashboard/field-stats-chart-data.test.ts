import { describe, expect, it } from 'vitest';
import { fieldChartRows } from './field-stats-chart-data';
const base = { fieldId: 'field', fieldName: 'Field', fieldType: 'select' };
describe('field statistics chart data', () => {
  it('retains authored categories, count and localized empty values', () => {
    expect(
      fieldChartRows(
        {
          ...base,
          distribution: [
            { value: 'Artist', count: 7 },
            { value: '', count: 2 },
          ],
        },
        String,
        '(비어 있음)',
      ),
    ).toEqual([
      { name: 'Artist', value: 7 },
      { name: '(비어 있음)', value: 2 },
    ]);
  });
  it('retains date bucket identity without reordering or dropping zero values', () => {
    expect(
      fieldChartRows(
        {
          ...base,
          fieldType: 'date',
          dateDistribution: [
            { date: '2026-10-10', count: 0 },
            { date: '2026-10-11', count: 2 },
          ],
        },
        String,
        'empty',
      ),
    ).toEqual([
      { name: '2026-10-10', value: 0 },
      { name: '2026-10-11', value: 2 },
    ]);
  });
  it('derives histogram upper bounds from the bucket interval, including single bucket results', () => {
    const stat = {
      ...base,
      fieldType: 'number',
      min: 10,
      max: 29,
      avg: 19,
      count: 3,
      histogram: [
        { bucket: 10, count: 2 },
        { bucket: 20, count: 1 },
      ],
    };
    expect(fieldChartRows(stat, (v) => v.toFixed(1), 'empty')).toEqual([
      { name: '10.0 – 20.0', value: 2 },
      { name: '20.0 – 30.0', value: 1 },
    ]);
    expect(fieldChartRows({ ...stat, histogram: [{ bucket: 5, count: 1 }] }, String, 'empty')).toEqual([
      { name: '5 – 6', value: 1 },
    ]);
  });
});
