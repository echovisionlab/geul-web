import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageLoader } from '@/features/site/PageLoader';

import { ArtistDeleteDialogView } from './ArtistDeleteDialogView';

const meta = {
  title: 'Feature/Admin/Delete Dialog',
  tags: ['artist-closure'],
  component: ArtistDeleteDialogView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return (
      <ArtistDeleteDialogView
        {...args}
        loadingSurface={<PageLoader placement="flow" message={args.labels.loading} />}
        onClose={() => updateArgs({ opened: false })}
        onConfirm={() => updateArgs({ opened: false })}
      />
    );
  },
  decorators: [
    withFeatureLabels({
      labels: {
        title: 'common.actions.delete',
        confirm: 'common.actions.delete',
        cancel: 'common.actions.cancel',
        close: 'common.actions.close',
        loading: 'common.states.loading',
        failed: 'common.messages.failedToLoad',
        confirmation: { key: 'common.messages.deleteNamedItemConfirm', values: { name: '{name}' } },
        relationSummary: { key: 'common.messages.relatedItemsWillBeUnlinked', values: { count: '{count}' } },
      },
      project: (args, t) => ({
        previewError: args.previewError ? t('common.messages.failedToLoad') : args.previewError,
      }),
    }),
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    opened: true,
    artistName: 'Example Artist',
    previewLoading: false,
    loadingSurface: <PageLoader placement="flow" />,
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
