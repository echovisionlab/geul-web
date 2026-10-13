import type { Meta, StoryObj } from '@storybook/nextjs';
import { PublicSeriesPreview } from '../shared/PublicPreview';
const meta = {
  title: 'Pages/Public/Series',
  component: PublicSeriesPreview,
  args: { empty: false },
  argTypes: { empty: { control: 'boolean' } },
} satisfies Meta<typeof PublicSeriesPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Empty: Story = { args: { empty: true } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
