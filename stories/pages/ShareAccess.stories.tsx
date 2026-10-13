import type { Meta, StoryObj } from '@storybook/nextjs';
import { ShareAccessPreview } from '../shared/PublicPreview';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  title: 'Pages/Share/Password Gate',
  component: ShareAccessPreview,
  args: { state: 'ready' },
  argTypes: { state: previewStateControl },
} satisfies Meta<typeof ShareAccessPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Locked: Story = {};
export const Pending: Story = { args: { state: 'pending' } };
export const Error: Story = { args: { state: 'error' } };
