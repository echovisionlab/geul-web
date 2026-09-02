import type { Meta, StoryObj } from '@storybook/nextjs';
import { RouteProgressBar } from './RouteProgressBar';
import classes from './RouteProgressBar.stories.module.css';

const meta = {
  title: 'Core/Feedback/RouteProgressBar',
  component: RouteProgressBar,
  parameters: { layout: 'fullscreen' },
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
  parameters: { controls: { exclude: ['phase'] } },
  render: (args) => (
    <div className={classes.sequence}>
      <RouteProgressBar {...args} phase="loading" />
      <p>The route transition sequence plays once when the canvas loads, then the bar disappears.</p>
      <p>Reload the canvas to replay it.</p>
    </div>
  ),
};

export const Completing: Story = {
  args: { phase: 'completing' },
};
