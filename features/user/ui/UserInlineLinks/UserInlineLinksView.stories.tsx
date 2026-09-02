import type { Meta, StoryObj } from '@storybook/nextjs';
import { UserInlineLinksView } from './UserInlineLinksView';

const meta = {
  title: 'Feature/User/UserInlineLinksView',
  component: UserInlineLinksView,
  args: {
    users: [
      { id: '1', href: '/user/1', label: 'Writer One', avatarSrc: null, avatarFallback: 'W' },
      { id: '2', href: '/user/2', label: 'Writer Two', avatarSrc: null, avatarFallback: 'W' },
    ],
  },
} satisfies Meta<typeof UserInlineLinksView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextOnly: Story = { args: { showAvatars: false, separator: 'comma' } };
