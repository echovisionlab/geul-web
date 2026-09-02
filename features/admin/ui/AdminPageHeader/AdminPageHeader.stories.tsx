import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconPlus } from '@tabler/icons-react';

import { AdminPageHeader } from './AdminPageHeader';

const meta: Meta<typeof AdminPageHeader> = {
  title: 'Feature/Admin/AdminPageHeader',
  component: AdminPageHeader,
  parameters: { layout: 'padded' },
  args: {
    title: 'Posts',
    description: 'Manage published and draft posts.',
  },
};

export default meta;
type Story = StoryObj<typeof AdminPageHeader>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    items: [
      {
        key: 'create',
        type: 'action',
        label: 'New post',
        icon: <IconPlus size={16} />,
        onClick: () => {},
      },
      {
        key: 'guidelines',
        type: 'action',
        label: 'Guidelines',
        href: '/admin/docs/guidelines',
        emphasis: 'low',
      },
    ],
  },
};
