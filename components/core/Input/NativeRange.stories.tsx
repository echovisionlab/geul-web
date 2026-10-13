import type { Meta, StoryObj } from '@storybook/nextjs';
import { useArgs } from 'storybook/preview-api';
import { NativeRange } from './NativeRange';

const meta = {
  title: 'Core/Input/NativeRange',
  component: NativeRange,
  parameters: { layout: 'centered' },
  args: { label: 'Columns', min: 0, max: 12, step: 1, value: 0, onChange: () => {} },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <NativeRange
        {...args}
        valueText={args.value === 0 ? 'Automatic' : String(args.value)}
        onChange={(value) => updateArgs({ value })}
      />
    );
  },
} satisfies Meta<typeof NativeRange>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AutomaticColumns: Story = {};
export const ExplicitColumns: Story = { args: { value: 6 } };
export const Disabled: Story = { args: { disabled: true } };
