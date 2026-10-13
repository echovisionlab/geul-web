import type { Meta, StoryObj } from '@storybook/nextjs';
import { useArgs, useState } from 'storybook/preview-api';
import { Button } from '../Button';

import { EditorHeaderView, type EditorHeaderViewLabels } from './EditorHeaderView';

const labels: EditorHeaderViewLabels = {
  title: 'Title',
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
  render: function HeaderPreview(args) {
    const [, updateArgs] = useArgs();
    const [deleted, setDeleted] = useState(false);
    if (deleted) {
      return <Button onClick={() => setDeleted(false)}>Restore entry</Button>;
    }
    return (
      <EditorHeaderView
        {...args}
        hideBack
        onTitleChange={args.onTitleChange ? (title) => updateArgs({ title }) : undefined}
        onStatusChange={args.onStatusChange ? (status) => updateArgs({ status }) : undefined}
        onDelete={args.onDelete ? () => setDeleted(true) : undefined}
      />
    );
  },
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

export const PhoneActions: Story = {
  ...EditableWithCollaboration,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    ...EditableWithCollaboration.args,
    labels: { ...labels, collabButton: 'Draft · Collaborative editing' },
    onDelete: () => {},
  },
};
