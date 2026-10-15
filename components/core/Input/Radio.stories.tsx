import { localizeFixtureTree, useStorybookText } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { LayoutStack as Stack } from '../Layout';
import { Radio } from './Radio';

interface RadioGroupStoryProps {
  defaultValue?: string;
  disabled?: boolean;
  error?: string;
  animate?: boolean;
  readOnly?: boolean;
}

function RadioGroupStory({
  defaultValue = 'public',
  disabled = false,
  error,
  animate,
  readOnly,
}: RadioGroupStoryProps) {
  const text = useStorybookText();

  return localizeFixtureTree(
    <Radio.Group label="Visibility" defaultValue={defaultValue} error={error} animate={animate} readOnly={readOnly}>
      <Stack>
        <Radio value="public" label="Public" disabled={disabled} />
        <Radio value="members" label="Members only" disabled={disabled} />
        <Radio value="private" label="Private" disabled={disabled} />
      </Stack>
    </Radio.Group>,
    text,
  );
}

const meta = {
  title: 'Core/Input/Radio',
  component: RadioGroupStory,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shared monochrome radio selection fades with the existing 300ms ease-out motion tokens. Keyboard focus remains immediate; animate=false and reduced motion disable transitions.',
      },
    },
  },
} satisfies Meta<typeof RadioGroupStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { defaultValue: 'members' } };
export const Error: Story = { args: { error: 'Choose a visibility' } };
export const Disabled: Story = {
  args: { defaultValue: 'members', disabled: true },
};
export const WithoutMotion: Story = { args: { animate: false } };
export const ReadOnly: Story = { args: { defaultValue: 'members', readOnly: true } };
