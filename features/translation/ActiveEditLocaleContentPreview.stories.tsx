import type { Meta, StoryObj } from '@storybook/nextjs';
import { ActiveEditLocaleContentPreview } from './ActiveEditLocaleContentPreview';

const meta: Meta<typeof ActiveEditLocaleContentPreview> = {
  title: 'Feature/Translation/Active Locale Content Preview',
  component: ActiveEditLocaleContentPreview,
  parameters: { layout: 'padded' },
  args: { localeLabel: 'English', hasLiveRow: true, contentPreview: '' },
};
export default meta;
type Story = StoryObj<typeof ActiveEditLocaleContentPreview>;
export const Preparing: Story = { args: { loading: true, contentPreview: 'Hidden stale preview' } };
export const Empty: Story = {};
export const Ready: Story = { args: { contentPreview: 'Translated archive description.' } };
