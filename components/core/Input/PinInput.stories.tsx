import type { Meta, StoryObj } from '@storybook/nextjs';
import { PinInput } from './PinInput';

const meta = {
  title: 'Core/Input/PinInput',
  component: PinInput,
  parameters: { layout: 'centered' },
  args: {
    length: 6,
    ariaLabel: 'Verification code',
  },
} satisfies Meta<typeof PinInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: '482193' } };
export const Masked: Story = { args: { mask: true } };
export const Invalid: Story = { args: { error: true } };
export const Disabled: Story = { args: { defaultValue: '482193', disabled: true } };
