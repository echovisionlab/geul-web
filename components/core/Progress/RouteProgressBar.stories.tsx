import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';
import { RouteProgressBar } from './RouteProgressBar';
import { LayoutInset } from '../Layout';
import { Text } from '../Typography';

const meta = {
  title: 'Core/Feedback/RouteProgressBar',
  component: RouteProgressBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Places the shared Progress primitive at the viewport top edge with zero block inset. Navigation owns the delayed waiting/loading/completing/idle lifecycle. Loading has unknown duration and no numeric percentage; completing projects 100 only after route commit. The wrapper adds placement, visibility and pointer pass-through. It does not own a second bar or estimate completion with a separate crawl animation.',
      },
    },
  },
  args: {
    phase: 'loading',
    'aria-label': 'Loading page',
  },
  argTypes: {
    phase: {
      control: 'select',
      options: ['idle', 'waiting', 'loading', 'completing'],
    },
  },
} satisfies Meta<typeof RouteProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <LayoutInset space="lg">
      <RouteProgressBar {...args} />
      <Text size="xs" lang="en">
        Use Phase in Controls to inspect the actual shared bar and its visibility. Production navigation owns the
        lifecycle timers.
      </Text>
    </LayoutInset>
  ),
  play: async ({ canvasElement, args }) => {
    const route = canvasElement.querySelector<HTMLElement>('[data-route-progress]')!;
    const bar = route.querySelector<HTMLElement>('[role="progressbar"]')!;
    await expect(bar).toHaveAttribute('data-core-progress');
    const hidden = args.phase === 'waiting' || args.phase === 'idle';
    await expect(bar.hidden).toBe(hidden);
    const style = getComputedStyle(route);
    await expect(style.paddingBlockStart).toBe('0px');
    await expect(style.paddingBlockEnd).toBe('0px');
    await expect(style.top).toBe('0px');
    if (!hidden) {
      await expect(route.getBoundingClientRect().height).toBe(2);
    }
  },
};

export const Waiting: Story = { args: { phase: 'waiting' } };
export const Idle: Story = { args: { phase: 'idle' } };

export const Completing: Story = {
  args: { phase: 'completing' },
};
