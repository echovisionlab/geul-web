import type { Meta, StoryObj } from '@storybook/nextjs';

import { ArtistDeleteDialogView } from './ArtistDeleteDialogView';

const meta = {
  title: 'Feature/Artist/Delete Dialog',
  tags: ['artist-closure'],
  component: ArtistDeleteDialogView,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: true,
    artistName: 'Example Artist',
    previewLoading: false,
    previewError: null,
    deleting: false,
    preview: {
      revision: 'revision-1',
      totalRelationCount: 3,
      impacts: [
        {
          domain: 2,
          entityId: 'label-1',
          label: 'Example Label',
          relationCount: 1,
        },
        {
          domain: 4,
          entityId: 'release-1',
          label: 'Example Release',
          relationCount: 2,
        },
      ],
    },
    labels: {
      title: 'Delete artist',
      confirm: 'Delete',
      cancel: 'Cancel',
      close: 'Close',
      loading: 'Loading...',
      failed: 'Failed to load data.',
      confirmation: 'Are you sure you want to delete {name}?',
      relationSummary: '{count} related items will be unlinked.',
    },
    onClose: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof ArtistDeleteDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExactImpact: Story = {};

export const Loading: Story = {
  args: { preview: null, previewLoading: true },
};

export const StaleOrFailed: Story = {
  args: {
    preview: null,
    previewError: 'Artist relations changed; preview deletion again',
  },
};
