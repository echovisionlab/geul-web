import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box, Group } from '@mantine/core';
import { MyArtistsTableCellView } from './MyArtistsTableCellView';

const meta: Meta<typeof MyArtistsTableCellView> = {
  title: 'Feature/My/ArtistsTable/Cell',
  component: MyArtistsTableCellView,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box maw={480}>
        <Story />
      </Box>
    ),
  ],
  args: {
    cell: 'name',
    row: {
      id: 'artist-mina',
      name: 'Mina Park',
      slugLabel: '/mina-park',
      imageUrl: null,
      avatarFallback: 'M',
      href: '/artists/artist-mina?edit=true',
      statusLabel: 'Published',
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
    <Group wrap="nowrap">
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
    </Group>
  ),
};
