import type { Meta, StoryObj } from '@storybook/nextjs';
import { useArgs, useState } from 'storybook/preview-api';
import { expect, within, userEvent } from 'storybook/test';
import { Button } from '../Button';
import { useRef } from 'react';

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

export const AsyncBack: Story = {
  render: function BackPreview(args) {
    const finish = useRef<(() => void) | undefined>(undefined);
    return (
      <>
        <EditorHeaderView
          {...args}
          onBack={() =>
            new Promise<void>((resolve) => {
              finish.current = resolve;
            })
          }
        />
        <Button onClick={() => finish.current?.()}>Complete simulated navigation</Button>
      </>
    );
  },
};

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

const checkSaveStatus: Story['play'] = async ({ canvasElement, args }) => {
  // The indicator names itself in the active locale, so find it by status, not by English text.
  const indicator = within(canvasElement)
    .getAllByRole('img')
    .find((element) => element.getAttribute('data-collab-status') === args.saveState);
  await expect(indicator).toBeDefined();
  const name = indicator!.getAttribute('aria-label') ?? '';
  await expect(name).not.toBe('');
  // A real pointer arrives by moving; React Aria shows hover hints only after pointer modality.
  await userEvent.pointer([{ target: canvasElement }, { target: indicator! }]);
  await userEvent.hover(indicator!);
  await expect(await within(document.body).findByRole('tooltip', {}, { timeout: 2000 })).toHaveTextContent(name);
  await userEvent.unhover(indicator!);
};
export const Saved: Story = {
  play: checkSaveStatus,
  args: { saveState: 'saved', labels: { ...labels, syncStatus: 'Saved' } },
};
export const Saving: Story = {
  play: checkSaveStatus,
  args: { saveState: 'saving', labels: { ...labels, syncStatus: 'Saving…' } },
};
export const Offline: Story = {
  play: checkSaveStatus,
  args: { saveState: 'offline', labels: { ...labels, syncStatus: 'Offline · edits kept on this device' } },
};
export const Error: Story = {
  play: checkSaveStatus,
  args: { saveState: 'error', labels: { ...labels, syncStatus: 'Save failed · retrying…' } },
};
export const Rejected: Story = {
  play: checkSaveStatus,
  args: { saveState: 'rejected', labels: { ...labels, syncStatus: "Some edits couldn't be saved" } },
};
export const Reload: Story = {
  play: checkSaveStatus,
  args: { saveState: 'reload', labels: { ...labels, syncStatus: 'Reconnecting · restoring edits…' } },
};
