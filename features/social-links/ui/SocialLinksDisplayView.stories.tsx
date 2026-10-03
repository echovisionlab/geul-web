import type { Meta, StoryObj } from '@storybook/nextjs';
import { SOCIAL_ICON_DEFINITIONS } from '@/components/core/Social';
import { SocialLinksDisplayView } from './SocialLinksDisplayView';

const meta = {
  title: 'Feature/SocialLinks/SocialLinksDisplayView',
  component: SocialLinksDisplayView,
  args: {
    entries: [
      {
        key: '0',
        platform: 'instagram',
        url: 'https://instagram.com/example-studio',
        label: 'Instagram',
        glyph: {
          path: SOCIAL_ICON_DEFINITIONS.instagram.icon.path,
          light: `#${SOCIAL_ICON_DEFINITIONS.instagram.icon.hex}`,
        },
      },
      {
        key: '1',
        platform: 'bandcamp',
        url: 'https://example-studio.bandcamp.com',
        label: 'Bandcamp',
        glyph: {
          path: SOCIAL_ICON_DEFINITIONS.bandcamp.icon.path,
          light: `#${SOCIAL_ICON_DEFINITIONS.bandcamp.icon.hex}`,
        },
      },
    ],
  },
} satisfies Meta<typeof SocialLinksDisplayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Icons: Story = {};
export const List: Story = { args: { variant: 'list', showLabels: true } };
