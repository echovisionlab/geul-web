import type { Meta, StoryObj } from '@storybook/nextjs';

import { Text } from '@mantine/core';
import { TextInput } from '../Input';
import { ContentModal } from './ContentModal';
import { ConfirmModal } from './ConfirmModal';
import { FormModal } from './FormModal';

interface ModalStoryArgs {
  onClose: () => void;
  onConfirm: () => void;
  onSubmit: () => void;
}

const meta: Meta<ModalStoryArgs> = {
  title: 'Core/Modal',
  tags: ['modal'],
  parameters: { layout: 'centered' },
  args: {
    onClose: () => {},
    onConfirm: () => {},
    onSubmit: () => {},
  },
};

export default meta;
type Story = StoryObj<ModalStoryArgs>;

export const Destructive: Story = {
  render: ({ onClose, onConfirm }) => (
    <ConfirmModal
      opened
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete release"
      message="This action permanently removes the release."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      closeLabel="Close dialog"
    />
  ),
};

export const Loading: Story = {
  render: ({ onClose, onConfirm }) => (
    <ConfirmModal
      opened
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete release"
      message="Deleting the release..."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      closeLabel="Close dialog"
      loading
    />
  ),
};

export const Disabled: Story = {
  render: ({ onClose, onConfirm }) => (
    <ConfirmModal
      opened
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete release"
      message="Select a release before continuing."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      closeLabel="Close dialog"
      confirmDisabled
    />
  ),
};

export const CompactCentered: Story = {
  render: ({ onClose, onConfirm }) => (
    <ConfirmModal
      opened
      onClose={onClose}
      onConfirm={onConfirm}
      title="Restore version"
      message="Restore to v12? The current state will be saved before restoring."
      confirmLabel="Restore"
      cancelLabel="Cancel"
      closeLabel="Close dialog"
      confirmTone="accent"
      centered
      size="compact"
    />
  ),
};

export const Form: Story = {
  render: ({ onClose, onSubmit }) => (
    <FormModal
      opened
      onClose={onClose}
      onSubmit={onSubmit}
      title="Edit release"
      submitLabel="Save"
      cancelLabel="Cancel"
      closeLabel="Close dialog"
      size="large"
    >
      <Text size="sm">Update the display title.</Text>
      <TextInput label="Release title" />
    </FormModal>
  ),
};

export const Content: Story = {
  render: ({ onClose }) => (
    <ContentModal
      id="audio-ingest-dialog"
      opened
      onClose={onClose}
      title="Add audio"
      closeLabel="Close dialog"
      centered
      size="large"
    >
      <Text size="sm">Upload a local file or import a direct audio file URL.</Text>
    </ContentModal>
  ),
};
