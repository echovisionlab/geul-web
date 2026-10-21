import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';

import { LinkCardView } from './LinkCardView';

const THUMBNAIL = '/storybook/media/video-poster.jpg';

const meta: Meta<typeof LinkCardView> = {
  title: 'Feature/Media/Link Card',
  component: LinkCardView,
  tags: ['link-card'],
  parameters: { layout: 'padded' },
  args: {
    url: 'https://www.discogs.com/release/1234567-Example-Live-At-The-Hall',
    title: 'Example – Live at the Hall',
    description: 'Vinyl, LP, Album, Limited Edition. Released in 2026 with a 12-page booklet and a download code.',
    siteName: 'Discogs',
    thumbnailUrl: THUMBNAIL,
  },
};
export default meta;
type Story = StoryObj<typeof LinkCardView>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link');
    await expect(link).toHaveAttribute('href', meta.args?.url);
    await expect(link).toHaveTextContent('Discogs · discogs.com');
  },
};
export const WithoutThumbnail: Story = { args: { thumbnailUrl: null } };
export const WithoutDescription: Story = { args: { description: '' } };
/** A preview that could not be read: the card falls back to the host. */
export const HostOnly: Story = {
  args: {
    url: 'https://github.com/echovisionlab/geul',
    title: '',
    description: '',
    siteName: '',
    thumbnailUrl: null,
  },
};
export const LongTitle: Story = {
  args: {
    title:
      'An unusually long page title that keeps going to check that the card clamps it to two lines without pushing the thumbnail out of the row',
  },
};
export const LoadingPreview: Story = {
  args: { title: '', description: '', siteName: '', thumbnailUrl: null, loadingLabel: 'Loading preview…' },
};
/** The editor renders the same card without navigation. */
export const EditorCard: Story = { args: { interactive: false } };
/** In a narrow column the thumbnail keeps its share of the row and the text wraps. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
