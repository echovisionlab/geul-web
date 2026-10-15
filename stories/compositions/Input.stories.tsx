import type { Meta, StoryObj } from '@storybook/nextjs';
import { InputPreview } from '../shared/ControlPreviews';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  title: 'Composition/Input Controls',
  component: InputPreview,
  args: { state: 'ready' },
  argTypes: { state: previewStateControl },
} satisfies Meta<typeof InputPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Error: Story = { args: { state: 'error' } };
export const Disabled: Story = { args: { state: 'disabled' } };
