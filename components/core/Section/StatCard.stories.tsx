import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { IconChartBar, IconUsers } from '@tabler/icons-react';
import { StatCard } from './StatCard';
const meta: Meta<typeof StatCard> = {
  title: 'Core/Layout/StatCard',
  component: StatCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(640px, 94vw)' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof StatCard>;
export const StatCardMatrix: Story = {
  render: localizedRender(() => (
    <DsLayoutInline align="stretch">
      <StatCard label="Subscribers" value="1,284" icon={IconUsers} />
      <StatCard label="Delivery rate" value="98.6%" tone="positive" icon={IconChartBar} description="Last 30 days" />
      <StatCard label="Failures" value="12" tone="danger" description="Needs review" />
    </DsLayoutInline>
  )),
};
export const LinkedMetric: Story = {
  render: localizedRender(() => (
    <DsLayoutInline align="stretch">
      <StatCard label="Users" value="1,284" icon={IconUsers} href="/admin/users" prefetch={false} />
      <StatCard label="Comments" value="96" icon={IconChartBar} />
    </DsLayoutInline>
  )),
};
