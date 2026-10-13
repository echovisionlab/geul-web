import type { Meta, StoryObj } from '@storybook/nextjs';
import { AdminPreview } from '../shared/AdminPreview';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  title: 'Composition/Admin Workspace',
  component: AdminPreview,
  args: { state: 'ready', empty: false },
  argTypes: { state: previewStateControl, empty: { control: 'boolean' } },
} satisfies Meta<typeof AdminPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Workspace: Story = {};
export const Empty: Story = { args: { empty: true } };
export const Pending: Story = { args: { state: 'pending' } };
export const Error: Story = { args: { state: 'error' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
