import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconPencil } from '@tabler/icons-react';
import { ToolbarCommand } from './ToolbarCommand';
import { localizedRender } from '../../../.storybook/fixture-i18n';
const meta = {
  title: 'Core/Actions/ToolbarCommand',
  component: ToolbarCommand,
  args: { label: 'Edit', icon: <IconPencil size="1em" />, presentation: 'responsive' },
  render: localizedRender((args) => {
    const [pressed, setPressed] = useState(false);
    // A toggle command owns its selected treatment; tone and emphasis do not apply.
    const { tone: _tone, emphasis: _emphasis, ...command } = args;
    return <ToolbarCommand {...command} pressed={pressed} onClick={() => setPressed(!pressed)} />;
  }),
} satisfies Meta<typeof ToolbarCommand>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Responsive: Story = {};
export const Icon: Story = { args: { presentation: 'icon' } };
export const Label: Story = { args: { presentation: 'label' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const LongLabel: Story = {
  args: { label: 'Review this publication and all translated content', presentation: 'responsive' },
};
