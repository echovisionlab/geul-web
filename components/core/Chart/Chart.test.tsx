// @vitest-environment jsdom
import { act, cloneElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Chart, type ChartKind } from './Chart';
vi.mock('recharts', async (importActual) => ({
  ...(await importActual<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 400, height: 300 }),
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
const labels = { category: 'Category', value: 'Count', percentage: '%' };
const kinds: ChartKind[] = ['donut', 'pie', 'bar-horizontal', 'bar-vertical', 'radar', 'area', 'line', 'histogram'];
describe('Core chart accessibility and ownership', () => {
  it.each(kinds)(
    'places the first %s hover label at its measured coordinates without animating from the origin',
    async (kind) => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('recharts-tooltip-wrapper')
          ? new DOMRect(0, 0, 120, 32)
          : new DOMRect(0, 0, 400, 300);
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(400);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
      await act(async () =>
        root.render(
          <Chart
            kind={kind}
            label="Responses"
            labels={labels}
            data={[
              { name: 'Alpha', value: 3 },
              { name: 'Beta', value: 1 },
            ]}
          />,
        ),
      );
      const tooltip = container.querySelector<HTMLElement>('.recharts-tooltip-wrapper')!;
      expect(tooltip.style.visibility).toBe('hidden');
      const enter = (index: number) => {
        if (kind === 'pie' || kind === 'donut') {
          const sector = container.querySelectorAll('.recharts-pie-sector')[index];
          sector.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        } else {
          container.querySelector('.recharts-wrapper')!.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              clientX: index === 0 ? 180 : 290,
              clientY: index === 0 ? 120 : 180,
            }),
          );
        }
      };
      await act(async () => {
        enter(0);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
      expect(tooltip.style.visibility).toBe('visible');
      expect(tooltip.textContent).toMatch(/Alpha|Beta/);
      expect(tooltip.style.transform).toMatch(/^translate\([\d.]+px, [\d.]+px\)$/);
      expect(tooltip.style.transform).not.toBe('translate(0px, 0px)');
      expect(tooltip.style.transition).toBe('');
      const firstPosition = tooltip.style.transform;
      await act(async () => {
        enter(1);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
      expect(tooltip.style.visibility).toBe('visible');
      expect(tooltip.style.transform).not.toBe(firstPosition);
      expect(tooltip.style.transition).toBe('');
    },
  );
  it.each(kinds)('exposes the full dataset once in a semantic table for %s, independent of SVG measurement', (kind) => {
    act(() =>
      root.render(
        <Chart
          kind={kind}
          label="Responses"
          labels={labels}
          data={[
            { name: 'Alpha', value: 3 },
            { name: 'Beta', value: 1 },
          ]}
          formatPercentage={(value) => `${(value * 100).toFixed(1)}%`}
        />,
      ),
    );
    const figure = container.querySelector('figure')!;
    expect(document.getElementById(figure.getAttribute('aria-labelledby')!)?.textContent).toBe('Responses');
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelector('table')?.textContent).toContain('Alpha375.0%Beta125.0%');
    expect(container.querySelector('table')?.closest('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('[role="application"]')).toBeNull();
    const plot = container.querySelector('[aria-hidden="true"]')!;
    expect(plot.querySelector('svg')).not.toBeNull();
    expect(plot.querySelector('[tabindex="0"]')).toBeNull();
  });
});
