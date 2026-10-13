import { useArgs } from 'storybook/preview-api';
import { CheckboxPreview } from '@/stories/shared/PrimitiveInputPreviews';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { LayoutStack as Stack } from '../Layout';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Core/Input/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  render: function CheckboxStatePreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <Checkbox
        {...args}
        onChange={(event) => updateArgs({ checked: event.currentTarget.checked, indeterminate: false })}
      />
    );
  },
  args: { label: 'Visible to everyone' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { indeterminate: true } };
export const Error: Story = { args: { error: 'This choice is required' } };
export const Disabled: Story = {
  args: { defaultChecked: true, disabled: true },
};

export const Group: Story = {
  render: localizedRender(() => (
    <Checkbox.Group label="Notifications" defaultValue={['releases']}>
      <Stack>
        <Checkbox value="releases" label="New releases" />
        <Checkbox value="comments" label="New comments" />
        <Checkbox value="mentions" label="Mentions" />
      </Stack>
    </Checkbox.Group>
  )),
};

export const CompactEditor: Story = { args: { size: 'xs', defaultChecked: true } };
export const ReadOnly: Story = { args: { defaultChecked: true, readOnly: true } };
export const DisabledUnchecked: Story = { args: { disabled: true } };
export const CheckedIndeterminate: Story = { args: { defaultChecked: true, indeterminate: true } };
export const Sizes: Story = {
  render: localizedRender(() => (
    <Stack gap="xs">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <Checkbox key={size} size={size} label={size} defaultChecked />
      ))}
      <Checkbox size="xs" density="compact" label="Compact" defaultChecked />
    </Stack>
  )),
};

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof CheckboxPreview>;
export const Playground: PlaygroundStory = {
  render: (args) => <CheckboxPreview {...args} />,
  args: { disabled: false, indeterminate: false },
  argTypes: { disabled: { control: 'boolean' }, indeterminate: { control: 'boolean' } },
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};
export const PlaygroundIndeterminate: PlaygroundStory = {
  ...Playground,
  args: { ...Playground.args, indeterminate: true },
};
export const PlaygroundDisabled: PlaygroundStory = { ...Playground, args: { ...Playground.args, disabled: true } };
