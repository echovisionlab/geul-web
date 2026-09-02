import type { Meta, StoryObj } from '@storybook/nextjs';
import { FileInput } from './FileInput';

const meta = {
  title: 'Core/Input/FileInput',
  component: FileInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Attachment',
    placeholder: 'Choose a file',
    clearable: true,
    w: 420,
  },
} satisfies Meta<typeof FileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ImageOnly: Story = { args: { accept: 'image/png,image/jpeg,image/webp' } };
export const Error: Story = { args: { error: 'Choose a supported file' } };
export const Disabled: Story = { args: { disabled: true } };
