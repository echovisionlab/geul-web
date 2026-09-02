import type { Meta, StoryObj } from '@storybook/nextjs';

import { VersionHistoryDrawerView, type VersionHistoryDrawerViewLabels } from './VersionHistoryDrawerView';

const labels: VersionHistoryDrawerViewLabels = {
  title: 'Version history',
  close: 'Close',
  loading: 'Loading...',
  empty: 'No versions yet. A version is created after an editing session ends.',
  restore: 'Restore',
  restoreTitle: 'Restore version',
  restoreBody: 'Restoring to v12 will replace the current state. Continue?',
  cancel: 'Cancel',
};

const versions = [
  {
    id: 'version-12',
    version: 12,
    versionLabel: 'v12',
    title: 'Revised exhibition notes',
    createdAtLabel: '8 minutes ago',
    createdAtTooltip: 'July 20, 2026 at 10:32',
    contributorLabel: 'by Mina Park and 01JZ9A3W6Y7T8V9X0ABCDEF123',
  },
  {
    id: 'version-11',
    version: 11,
    versionLabel: 'v11',
    title: 'Untitled',
    createdAtLabel: 'yesterday',
    createdAtTooltip: 'July 19, 2026 at 14:10',
    contributorLabel: 'System or earlier version',
  },
];

const meta = {
  title: 'Feature/VersionHistory/VersionHistoryDrawerView',
  component: VersionHistoryDrawerView,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: true,
    onClose: () => {},
    versions,
    labels,
    loading: false,
    restoring: false,
    canRestore: true,
    selectedVersionId: null,
    restoreConfirmationOpened: false,
    onSelectVersion: () => {},
    onCloseRestoreConfirmation: () => {},
    onRestore: () => {},
  },
} satisfies Meta<typeof VersionHistoryDrawerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
  args: { versions: [] },
};

export const Loading: Story = {
  args: { loading: true, versions: [] },
};

export const RestoreLocked: Story = {
  args: { canRestore: false },
};

export const RestoreConfirmation: Story = {
  args: {
    selectedVersionId: 'version-12',
    restoreConfirmationOpened: true,
  },
};

export const Restoring: Story = {
  args: {
    selectedVersionId: 'version-12',
    restoreConfirmationOpened: true,
    restoring: true,
  },
};
