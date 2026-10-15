// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import { FieldStatsChart } from './FieldStatsChart';
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function render(stat: Parameters<typeof FieldStatsChart>[0]['fieldStat'], locale = 'en') {
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ko' ? ko : en}>
        <FieldStatsChart fieldStat={stat} />
      </NextIntlClientProvider>,
    ),
  );
}
describe('actual field statistics UI', () => {
  it('reads distribution values and localized totals in the chart accessible table', () => {
    render(
      {
        fieldId: 'a',
        fieldName: 'Artist',
        fieldType: 'select',
        distribution: [
          { value: 'Monome', count: 3 },
          { value: '', count: 1 },
        ],
      },
      'ko',
    );
    expect(container.querySelector('figure')?.dataset.kind).toBe('donut');
    expect(container.querySelector('table')?.textContent).toContain('Monome375.0%');
    expect(container.querySelector('table')?.textContent).toContain('(비어 있음)125.0%');
    expect(container.querySelector('[aria-label="차트 유형"]')).not.toBeNull();
  });
  it('keeps numeric min/max/mean/count summaries and histogram upper bounds', () => {
    render({
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
    });
    expect(container.querySelector('figure')?.dataset.kind).toBe('histogram');
    expect(container.textContent).toContain('Minimum: 0.00');
    expect(container.textContent).toContain('Average: 8.25');
    expect(container.textContent).toContain('Count: 4');
    expect(container.querySelector('table')?.textContent).toContain('0.0 – 10.0');
  });
  it('changes the field-specific chart default when the rendered field changes', () => {
    render({ fieldId: 'a', fieldName: 'Artist', fieldType: 'select', distribution: [{ value: 'A', count: 1 }] });
    render({
      fieldId: 'd',
      fieldName: 'Date',
      fieldType: 'date',
      dateDistribution: [{ date: '2026-10-10', count: 1 }],
    });
    expect(container.querySelector('figure')?.dataset.kind).toBe('area');
    expect(container.querySelector('table')?.textContent).toContain('2026-10-10');
  });
  it('uses the catalogue locale for the empty response state without rendering a misleading plot', () => {
    render({ fieldId: 'e', fieldName: 'Empty', fieldType: 'select', distribution: [] }, 'ko');
    expect(container.textContent).toContain('아직 응답이 없습니다');
    expect(container.querySelector('figure')).toBeNull();
  });
  it('switches the actual Select across every distribution chart and its visible table', async () => {
    render({
      fieldId: 'a',
      fieldName: 'Artist',
      fieldType: 'select',
      distribution: [
        { value: 'Monome', count: 3 },
        { value: 'TX–6', count: 1 },
      ],
    });
    for (const [name, kind] of [
      ['Pie', 'pie'],
      ['Horizontal bars', 'bar-horizontal'],
      ['Vertical bars', 'bar-vertical'],
      ['Radar', 'radar'],
      ['Table', 'table'],
      ['Donut', 'donut'],
    ]) {
      await act(async () => {
        const button = container.querySelector('button')!;
        button.focus();
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 35));
      });
      const option = Array.from(document.querySelectorAll('[role="option"]')).find(
        (node) => node.textContent === name,
      ) as HTMLElement;
      expect(option, name).toBeTruthy();
      await act(async () => {
        option.click();
        await new Promise((resolve) => setTimeout(resolve, 35));
      });
      if (kind === 'table') {
        expect(container.querySelector('figure')).toBeNull();
        expect(container.querySelector('table')?.textContent).toContain('Monome375.0%');
      } else {
        expect(container.querySelector('figure')?.dataset.kind).toBe(kind);
      }
    }
  });
});
