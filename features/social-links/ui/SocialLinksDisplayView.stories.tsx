import type { Meta, StoryObj } from '@storybook/nextjs';
import { SocialLinksDisplayView } from './SocialLinksDisplayView';

const meta = {
  title: 'Feature/SocialLinks/SocialLinksDisplayView',
  component: SocialLinksDisplayView,
  args: {
    entries: [
      { key: '0', platform: 'instagram', url: 'https://instagram.com/example-studio', label: 'Instagram' },
      { key: '1', platform: 'bandcamp', url: 'https://example-studio.bandcamp.com', label: 'Bandcamp' },
    ],
  },
} satisfies Meta<typeof SocialLinksDisplayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Icons: Story = {};
export const List: Story = { args: { variant: 'list', showLabels: true } };
