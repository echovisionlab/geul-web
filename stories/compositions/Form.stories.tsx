import type { Meta, StoryObj } from '@storybook/nextjs';
import { CollectionFormPreview } from '../shared/CompositionPreviews';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  parameters: { canvasInset: 'none' },
  title: 'Composition/Form',
  component: CollectionFormPreview,
  args: { state: 'ready' },
  argTypes: { state: previewStateControl },
} satisfies Meta<typeof CollectionFormPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Pending: Story = { args: { state: 'pending' } };
export const Error: Story = { args: { state: 'error' } };
