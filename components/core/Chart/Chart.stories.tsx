import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor } from 'storybook/test';
import { useFormatter, useTranslations } from 'next-intl';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { Chart, type ChartKind } from './Chart';
const meta: Meta<typeof Chart> = {
  title: 'Core/Data Display/Chart',
  component: Chart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Chart owns Recharts rendering, token-backed series and the complete semantic data table. Hover labels appear immediately at measured data coordinates and move without a position transition. Tooltips are visual supplements; the table retains every value independently of pointer interaction. Field Statistics consumes this contract for distribution, date and numeric modes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Chart>;
const chartKinds: ChartKind[] = [
  'donut',
  'pie',
  'bar-horizontal',
  'bar-vertical',
  'radar',
  'area',
  'line',
  'histogram',
];
function AllModes() {
  const t = useTranslations('formDashboardPage.charts');
  const format = useFormatter();
  return (
    <LayoutStack gap="xl">
      {chartKinds.map((kind) => (
        <LayoutStack key={kind} gap="sm">
          <Text weight="medium">{t(kind)}</Text>
          <Chart
            kind={kind}
            label={t(kind)}
            labels={{ category: t('value'), value: t('count'), percentage: '%' }}
            data={[
              { name: 'Monome', value: 7 },
              { name: 'TX–6', value: 5 },
              { name: 'T 1000', value: 3 },
            ]}
            formatValue={(v) => format.number(v)}
            formatPercentage={(v) => format.number(v, { style: 'percent', maximumFractionDigits: 1 })}
          />
        </LayoutStack>
      ))}
    </LayoutStack>
  );
}
export const Modes: Story = {
  render: () => <AllModes />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('figure[data-kind]')).toHaveLength(chartKinds.length));
    for (const kind of chartKinds) {
      const figure = canvasElement.querySelector<HTMLElement>(`figure[data-kind="${kind}"]`)!;
      figure.scrollIntoView({ block: 'center' });
      const wrapper = await waitFor(() => {
        // ResponsiveContainer mounts its chart after ResizeObserver measures the plot.
        const measured = figure.querySelector<HTMLElement>('.recharts-wrapper');
        expect(measured).not.toBeNull();
        expect(measured!.getBoundingClientRect().width).toBeGreaterThan(0);
        return measured!;
      });
      const tooltip = await waitFor(() => {
        const rendered = figure.querySelector<HTMLElement>('.recharts-tooltip-wrapper');
        expect(rendered).not.toBeNull();
        return rendered!;
      });
      await expect(tooltip).not.toBeVisible();
      if (kind === 'donut' || kind === 'pie') {
        const sector = await waitFor(() => {
          const rendered = figure.querySelector('.recharts-pie-sector');
          expect(rendered).not.toBeNull();
          return rendered!;
        });
        await userEvent.hover(sector);
      } else if (kind === 'radar') {
        const spoke = await waitFor(() => {
          const rendered = figure.querySelector<SVGLineElement>('.recharts-polar-grid-angle line');
          expect(rendered).not.toBeNull();
          expect(rendered!.getScreenCTM()).not.toBeNull();
          return rendered!;
        });
        // A wide wrapper includes space outside the polar plot. Use the rendered grid's real hit coordinates.
        const point = new DOMPoint(
          (spoke.x1.baseVal.value + spoke.x2.baseVal.value) / 2,
          (spoke.y1.baseVal.value + spoke.y2.baseVal.value) / 2,
        ).matrixTransform(spoke.getScreenCTM()!);
        await userEvent.pointer({ target: spoke, coords: { clientX: point.x, clientY: point.y } });
      } else {
        const bounds = wrapper.getBoundingClientRect();
        await userEvent.pointer({
          target: wrapper,
          coords: { clientX: bounds.left + bounds.width * 0.62, clientY: bounds.top + bounds.height * 0.42 },
        });
      }
      await waitFor(() => {
        if (getComputedStyle(tooltip).visibility !== 'visible') {
          throw new Error(`${kind}: first hover did not open the tooltip; ${tooltip.getAttribute('style')}`);
        }
        expect(tooltip).toBeVisible();
      });
      // Read the first painted hover position; delayed arrival at the final position is insufficient.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const style = getComputedStyle(tooltip);
      await expect(tooltip.style.transition).toBe('');
      await expect(style.transitionDuration).toBe('0s');
      const position = new DOMMatrixReadOnly(style.transform);
      await expect(position.m41 + position.m42).toBeGreaterThan(0);
      await expect(tooltip.textContent).toMatch(/Monome|TX–6|T 1000/);
      await userEvent.unhover(wrapper);
    }
  },
};
