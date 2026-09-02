import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconHistory } from '@tabler/icons-react';

import { EditorHeaderView, type EditorHeaderViewLabels } from './EditorHeaderView';

const labels: EditorHeaderViewLabels = {
  back: 'Back',
  untitled: 'Untitled',
  delete: 'Delete',
  cancel: 'Cancel',
  close: 'Close',
  changeStatus: 'Change status',
  collabButton: 'Draft · Collab',
  connection: 'Connection',
  current: 'Current',
  status: 'Status',
  actions: 'Actions',
  syncStatus: 'Synced',
};

const meta: Meta<typeof EditorHeaderView> = {
  title: 'Core/Layout/EditorHeader',
  component: EditorHeaderView,
  parameters: { layout: 'padded' },
  args: {
    title: 'Field recordings',
    isConnected: true,
    isSynced: true,
    onBack: () => {},
    labels,
  },
};

export default meta;
type Story = StoryObj<typeof EditorHeaderView>;

export const Default: Story = {};

export const EditableWithCollaboration: Story = {
  args: {
    status: 'draft',
    statusOptions: [
      {
        value: 'draft',
        label: 'Draft',
        actionLabel: 'Move to draft',
        tone: 'neutral',
      },
      {
        value: 'published',
        label: 'Published',
        actionLabel: 'Publish',
        tone: 'positive',
      },
    ],
    onTitleChange: () => {},
    onStatusChange: () => {},
    groupStatusWithCollab: true,
    collabActions: [
      {
        label: 'Version history',
        icon: <IconHistory size={14} />,
        onClick: () => {},
      },
    ],
  },
};

export const Destructive: Story = {
  args: {
    onDelete: () => {},
    deleteConfirmation: {
      title: 'Delete entry',
      message: 'This action cannot be undone.',
    },
  },
};
