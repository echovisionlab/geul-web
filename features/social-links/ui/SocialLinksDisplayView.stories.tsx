import type { Meta, StoryObj } from '@storybook/nextjs';
import { prepareSocialIcon } from '@/components/core/Social';
import { SocialLinksDisplayView } from './SocialLinksDisplayView';

const meta = {
  title: 'Feature/Social Links/SocialLinksDisplayView',
  component: SocialLinksDisplayView,
  args: {
    entries: [
      {
        key: '0',
        platform: 'instagram',
        url: 'https://instagram.com/example-studio',
        label: 'Instagram',
        glyph: prepareSocialIcon('instagram'),
      },
      {
        key: '1',
        platform: 'bandcamp',
        url: 'https://example-studio.bandcamp.com',
        label: 'Bandcamp',
        glyph: prepareSocialIcon('bandcamp'),
      },
    ],
  },
} satisfies Meta<typeof SocialLinksDisplayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Icons: Story = {};
export const List: Story = { args: { variant: 'list', showLabels: true } };
