import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Core/Layout/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  args: {
    title: 'Profile',
    description: 'Manage the information shown to other members.',
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {};

export const Centered: Story = {
  args: { align: 'center' },
};
