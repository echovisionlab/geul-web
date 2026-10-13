import type { Meta, StoryObj } from '@storybook/nextjs';
import { VerificationPreview } from '../shared/VerificationPreview';
import { previewStateControl } from '../shared/PreviewFrame';
const meta = {
  title: 'Pages/Auth/Verification',
  component: VerificationPreview,
  args: { state: 'ready', initialStep: 'choose_email' },
  argTypes: {
    state: previewStateControl,
    initialStep: { control: 'select', options: ['choose_email', 'sent_email', 'applying', 'passed'] },
  },
  render: (args) => <VerificationPreview key={args.initialStep} {...args} />,
} satisfies Meta<typeof VerificationPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Flow: Story = {};
export const AwaitingCode: Story = { args: { initialStep: 'sent_email' } };
export const Pending: Story = { args: { state: 'pending' } };
export const Error: Story = { args: { state: 'error' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
