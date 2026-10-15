import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { SegmentedProgress } from './SegmentedProgress';
const meta = {
  title: 'Core/Feedback/SegmentedProgress',
  component: SegmentedProgress,
  args: { label: 'Processing files', segments: [] },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SegmentedProgress>;
export default meta;
type Story = StoryObj<typeof meta>;
function Example({ compact = false }: { compact?: boolean }) {
  const text = useStorybookText();
  return (
    <SegmentedProgress
      label={text('Processing files')}
      density={compact ? 'compact' : 'labelled'}
      segments={[
        { id: 'done', label: text('Success'), value: 65, tone: 'positive' },
        { id: 'pending', label: text('Pending'), value: 12, tone: 'warning' },
        { id: 'failed', label: text('Error'), value: 3, tone: 'danger' },
      ]}
    />
  );
}
export const Labelled: Story = { render: () => <Example /> };
export const Compact: Story = { render: () => <Example compact /> };
