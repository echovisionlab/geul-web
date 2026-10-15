import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { MyArtistsTableCellView } from './MyArtistsTableCellView';

const meta: Meta<typeof MyArtistsTableCellView> = {
  title: 'Feature/My/Cell',
  component: MyArtistsTableCellView,
  parameters: { layout: 'padded' },
  decorators: [
    withFeatureLabels({
      project: (args, t, locale) => ({
        row: {
          ...(args.row as Record<string, unknown>),
          statusLabel: t('common.labels.published'),
          createdLabel: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
            new Date('2026-07-04T00:00:00Z'),
          ),
        },
      }),
    }),
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    cell: 'name',
    row: {
      id: 'artist-mina',
      name: 'Mina Park',
      slugLabel: '/mina-park',
      imageUrl: null,
      href: '/artists/artist-mina?edit=true',
      statusLabel: 'Published',
      statusTone: 'positive',
      createdLabel: 'Jul 4, 2026',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyArtistsTableCellView>;

export const Name: Story = {};

export const Avatar: Story = {
  args: { cell: 'avatar' },
};

export const Status: Story = {
  args: { cell: 'status' },
};

export const Created: Story = {
  args: { cell: 'created' },
};

export const LongName: Story = {
  render: (args) => (
    <DsLayoutInline wrap="nowrap">
      <MyArtistsTableCellView {...args} cell="avatar" />
      <MyArtistsTableCellView
        {...args}
        cell="name"
        row={{
          ...args.row,
          name: 'The International Collective for Long-Duration Electroacoustic Field Recording and Spatial Research',
          slugLabel: '/international-collective-for-long-duration-electroacoustic-field-recording-and-spatial-research',
        }}
      />
    </DsLayoutInline>
  ),
};
