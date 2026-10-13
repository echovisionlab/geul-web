import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { StatusBadge } from './StatusBadge';
const statusTones = ['neutral', 'accent', 'positive', 'warning', 'danger'] as const;
const meta: Meta<typeof StatusBadge> = {
  title: 'Core/Data Display/StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'centered' },
  args: { children: 'Published', tone: 'neutral' },
};
export default meta;
type Story = StoryObj<typeof StatusBadge>;
export const Default: Story = {};
export const StatusToneMatrix: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      <DsLayoutInline>
        {statusTones.map((tone) => (
          <StatusBadge key={tone} tone={tone}>
            {tone}
          </StatusBadge>
        ))}
      </DsLayoutInline>
      <DsLayoutInline>
        {statusTones.map((tone) => (
          <StatusBadge key={tone} tone={tone} appearance="solid">
            {tone}
          </StatusBadge>
        ))}
      </DsLayoutInline>
    </DsLayoutStack>
  )),
};
