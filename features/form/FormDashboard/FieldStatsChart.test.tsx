// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import ko from '@/messages/ko.json';
import { FieldStatsChart } from './FieldStatsChart';

beforeEach(() => {
  // jsdom has no layout; supply the chart's browser plot dimensions.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 300));
});
afterEach(() => vi.restoreAllMocks());

const distribution = {
  fieldId: 'a',
  fieldName: 'Artist',
  fieldType: 'select',
  distribution: [
    { value: 'Monome', count: 3 },
    { value: '', count: 1 },
  ],
};

describe('actual field statistics UI', () => {
  it('reads distribution values and localized totals in the chart accessible table', () => {
    render(<FieldStatsChart fieldStat={distribution} />, { locale: 'ko', messages: ko });
    expect(screen.getByRole('figure', { name: 'Artist' })).toHaveAttribute('data-kind', 'donut');
    const table = screen.getByRole('table', { name: 'Artist' });
    expect(within(table).getByRole('row', { name: /Monome.*3.*75\.0%/ })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /\(비어 있음\).*1.*25\.0%/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '차트 유형' })).toBeInTheDocument();
  });

  it('keeps numeric min, max, mean and count summaries for a histogram', () => {
    render(
      <FieldStatsChart
        fieldStat={{
          fieldId: 'n',
          fieldName: 'Score',
          fieldType: 'number',
          min: 0,
          max: 19,
          avg: 8.25,
          count: 4,
          histogram: [
            { bucket: 0, count: 3 },
            { bucket: 10, count: 1 },
          ],
        }}
      />,
    );
    expect(screen.getByRole('figure', { name: 'Score' })).toHaveAttribute('data-kind', 'histogram');
    expect(screen.getByText('Minimum:', { exact: false })).toHaveTextContent('Minimum: 0.00');
    expect(screen.getByText('Maximum:', { exact: false })).toHaveTextContent('Maximum: 19.00');
    expect(screen.getByText('Average:', { exact: false })).toHaveTextContent('Average: 8.25');
    expect(screen.getByText('Count:', { exact: false })).toHaveTextContent('Count: 4');
  });

  it('changes the field-specific chart default when the rendered field changes', () => {
    const { rerender } = render(<FieldStatsChart fieldStat={distribution} />);
    rerender(
      <FieldStatsChart
        fieldStat={{
          fieldId: 'd',
          fieldName: 'Date',
          fieldType: 'date',
          dateDistribution: [{ date: '2026-10-10', count: 1 }],
        }}
      />,
    );
    expect(screen.getByRole('figure', { name: 'Date' })).toHaveAttribute('data-kind', 'area');
    expect(screen.getByRole('table', { name: 'Date' })).toHaveTextContent('2026-10-10');
  });

  it('uses the catalogue locale for the empty response state', () => {
    render(<FieldStatsChart fieldStat={{ ...distribution, distribution: [] }} />, { locale: 'ko', messages: ko });
    expect(screen.getByText('아직 응답이 없습니다')).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('switches the actual Select to another plot and to the table alternative', async () => {
    const { user } = render(<FieldStatsChart fieldStat={distribution} />);
    await user.click(screen.getByRole('button', { name: 'Show suggestions' }));
    await user.click(await screen.findByRole('option', { name: 'Pie' }));
    expect(screen.getByRole('figure', { name: 'Artist' })).toHaveAttribute('data-kind', 'pie');
    await user.click(screen.getByRole('button', { name: 'Show suggestions' }));
    await user.click(await screen.findByRole('option', { name: 'Table' }));
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Artist' })).toHaveTextContent('Monome');
  });
});
