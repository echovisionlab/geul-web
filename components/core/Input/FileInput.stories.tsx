import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { FileInput } from './FileInput';

const meta = {
  title: 'Core/Input/FileInput',
  component: FileInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Attachment',
    placeholder: 'Choose a file',
    clearable: true,
  },
} satisfies Meta<typeof FileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSelection: Story = {};
export const MultipleSelection: Story = { args: { multiple: true } };
export const ImageOnly: Story = { args: { accept: 'image/png,image/jpeg,image/webp' } };
export const Error: Story = { args: { error: 'Choose a supported file' } };
export const Disabled: Story = { args: { disabled: true } };

export const ValidationRelationships: Story = {
  tags: ['a11y-smoke'],
  args: { description: 'WAV or MP3', error: 'Choose a supported file' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Attachment Choose a file' });
    await expect(button).toHaveAccessibleDescription('WAV or MP3 Choose a supported file');
    await expect(canvas.getByRole('group', { name: 'Attachment' })).toHaveAccessibleDescription(
      'WAV or MP3 Choose a supported file',
    );
  },
};
