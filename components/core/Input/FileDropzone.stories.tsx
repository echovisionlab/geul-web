import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { LayoutStack, LayoutContainer } from '../Layout';
import { Text } from '../Typography';

import { IconFileUpload } from '@tabler/icons-react';
import { FileDropzone } from './FileDropzone';

const meta = {
  title: 'Core/Input/FileDropzone',
  component: FileDropzone,
  tags: ['core-file-dropzone'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The same dropzone supports pointer, keyboard and drag/drop input. Use one selection story for all entry methods; the readout shows the last accepted and rejected files.',
      },
    },
  },
  render: function FileSelection(args) {
    const [accepted, setAccepted] = useState<string[]>([]);
    const [rejected, setRejected] = useState<string[]>([]);
    return (
      <LayoutStack gap="xs">
        <FileDropzone
          {...args}
          onFilesSelected={(files) => {
            setAccepted(files.map((file) => file.name));
            args.onFilesSelected(files);
          }}
          onFilesRejected={(files) => {
            setRejected(files.map(({ file, reason }) => `${file.name}: ${reason}`));
            args.onFilesRejected?.(files);
          }}
        />
        <Text size="xs" tone="secondary" aria-live="polite">
          Last accepted: {accepted.join(', ') || '—'}
        </Text>
        <Text size="xs" tone="secondary" aria-live="polite">
          Last rejected: {rejected.join(', ') || '—'}
        </Text>
      </LayoutStack>
    );
  },
  decorators: [
    (Story) => (
      <LayoutContainer size="compact">
        <Story />
      </LayoutContainer>
    ),
  ],
  args: {
    label: 'Choose files',
    title: 'Drop files here',
    description: 'Drop files here or use the keyboard to browse',
    icon: <IconFileUpload aria-hidden="true" />,
    accept: 'audio/wav,.wav,audio/mpeg,.mp3',
    multiple: true,
    maxFiles: 10,
    onFilesSelected: () => {},
    onFilesRejected: () => {},
  },
} satisfies Meta<typeof FileDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultipleSelection: Story = {};

export const Disabled: Story = {
  args: {
    label: 'File selection unavailable',
    disabled: true,
  },
};

export const SelectionLimits: Story = {
  args: {
    description: 'One audio file, up to 5 MB',
    maxSize: 5 * 1024 * 1024,
    maxFiles: 1,
  },
};

export const NativeSelectionValidation: Story = {
  tags: ['a11y-smoke'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Drop files here' })).toHaveAccessibleDescription(
      'Drop files here or use the keyboard to browse',
    );
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error('Expected the real file picker bridge');
    }
    await userEvent.upload(input, new File(['audio'], 'recording.wav', { type: 'audio/wav' }));
    await expect(canvas.getByText(/Last accepted: recording.wav/)).toBeInTheDocument();
  },
};
