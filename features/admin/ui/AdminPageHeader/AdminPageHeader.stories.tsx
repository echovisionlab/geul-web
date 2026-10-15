import { navigatePreview } from '@/stories/shared/preview-navigation';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconPlus } from '@tabler/icons-react';

import { AdminPageHeader } from './AdminPageHeader';

const meta: Meta<typeof AdminPageHeader> = {
  title: 'Feature/Admin/AdminPageHeader',
  component: AdminPageHeader,
  render: function InteractiveStory(args) {
    return (
      <AdminPageHeader
        {...args}
        items={args.items
          ?.filter((item) => item.key === 'create')
          .map((item) => ({ ...item, onClick: () => navigatePreview('/admin/posts/new') }))}
      />
    );
  },
  decorators: [
    withFeatureLabels({
      project: (args, t) => ({
        title: t('common.entities.posts'),
        items: (args.items as { key: string; label?: string }[] | undefined)?.map((item) => ({
          ...item,
          label: item.key === 'create' ? t('posts.createTooltip') : t('common.actions.openInNewTab'),
        })),
      }),
    }),
  ],
  parameters: { layout: 'padded' },
  args: {
    title: 'Posts',
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
