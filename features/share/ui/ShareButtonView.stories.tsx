import type { Meta, StoryObj } from '@storybook/nextjs';

import { ShareButtonView } from './ShareButtonView';

const meta = {
  title: 'Feature/Share/ShareButtonView',
  component: ShareButtonView,
  args: { label: 'Share', onShare: () => {} },
} satisfies Meta<typeof ShareButtonView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
