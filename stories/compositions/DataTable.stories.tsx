import type { Meta, StoryObj } from '@storybook/nextjs';
import { TableCompositionPreview } from '../shared/CompositionPreviews';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  parameters: { canvasInset: 'none' },
  title: 'Composition/Data Table',
  component: TableCompositionPreview,
  args: { state: 'ready', empty: false },
  argTypes: { state: previewStateControl, empty: { control: 'boolean' } },
} satisfies Meta<typeof TableCompositionPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Empty: Story = { args: { empty: true } };
export const Pending: Story = { args: { state: 'pending' } };
export const Error: Story = { args: { state: 'error' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
