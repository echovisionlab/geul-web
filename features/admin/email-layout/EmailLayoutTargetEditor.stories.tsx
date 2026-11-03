import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageLoader } from '@/features/site/PageLoader';
import { EmailLayoutTargetEditor } from './EmailLayoutTargetEditor';

const meta: Meta<typeof EmailLayoutTargetEditor> = {
  title: 'Feature/Admin/Email Layout Target Editor',
  component: EmailLayoutTargetEditor,
  parameters: { layout: 'padded' },
  args: {
    isReady: true,
    units: [],
    loadingSurface: <PageLoader placement="flow" />,
    onChange: () => {},
    onUseSource: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof EmailLayoutTargetEditor>;
export const Synchronizing: Story = { args: { isReady: false } };
export const ResolvedEmpty: Story = {};
export const SourceFallback: Story = {
  args: {
    units: [
      {
        handle: 'unit:heading',
        kind: 'text',
        element: '',
        attribute: '',
        order: 0,
        sourceValue: 'Archive',
        value: 'Archive',
        localeValuePresent: false,
      },
    ],
  },
};
