import type { Meta, StoryObj } from '@storybook/nextjs';
import { Slider } from './Slider';

const meta = {
  title: 'Core/Input/Slider',
  component: Slider,
  parameters: { layout: 'centered' },
  args: {
    defaultValue: 40,
    w: 420,
    'aria-label': 'Volume',
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithMarks: Story = {
  args: {
    defaultValue: 50,
    step: 25,
    marks: [
      { value: 0, label: '0' },
      { value: 50, label: '50' },
      { value: 100, label: '100' },
    ],
    mb: 28,
  },
};
export const FineGrained: Story = { args: { defaultValue: 0.7, min: 0, max: 1, step: 0.01 } };
export const Disabled: Story = { args: { defaultValue: 40, disabled: true } };
