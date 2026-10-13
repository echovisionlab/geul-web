import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { LabelBadge } from './LabelBadge';
const badgeTones = ['neutral', 'accent', 'positive', 'warning', 'danger'] as const;
const meta: Meta<typeof LabelBadge> = {
  title: 'Core/Data Display/LabelBadge',
  component: LabelBadge,
  parameters: { layout: 'centered' },
  args: { children: 'Published', tone: 'neutral' },
};
export default meta;
type Story = StoryObj<typeof LabelBadge>;
export const Default: Story = {};
export const LabelToneMatrix: Story = {
  render: localizedRender(() => (
    <DsLayoutInline>
      {badgeTones.map((tone) => (
        <LabelBadge key={tone} tone={tone}>
          {tone}
        </LabelBadge>
      ))}
    </DsLayoutInline>
  )),
};
export const Dismissible: Story = {
  render: localizedRender(() => (
    <DsLayoutInline>
      <LabelBadge onDismiss={() => {}} dismissLabel="Remove Published filter">
        Published
      </LabelBadge>
      <LabelBadge tone="accent" onDismiss={() => {}} dismissLabel="Remove Featured filter" dismissDisabled>
        Featured
      </LabelBadge>
    </DsLayoutInline>
  )),
};
