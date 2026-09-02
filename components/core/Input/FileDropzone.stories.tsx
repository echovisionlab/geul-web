import type { Meta, StoryObj } from '@storybook/nextjs';

import { Box } from '@mantine/core';
import { IconFileUpload } from '@tabler/icons-react';
import { FileDropzone } from './FileDropzone';

const meta = {
  title: 'Core/Input/FileDropzone',
  component: FileDropzone,
  tags: ['core-file-dropzone'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w="min(32rem, 88vw)">
        <Story />
      </Box>
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

export const KeyboardPicker: Story = {};

export const Disabled: Story = {
  args: {
    label: 'File selection unavailable',
    disabled: true,
  },
};

export const DragAndDrop: Story = {};

export const RejectedSelection: Story = {
  args: {
    maxFiles: 1,
  },
};
