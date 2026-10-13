import { TextInputPreview } from '@/stories/shared/PrimitiveInputPreviews';
import { previewStateControl } from '@/stories/shared/PreviewFrame';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { TextInput } from './TextInput';

const meta = {
  title: 'Core/Input/TextInput',
  component: TextInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Name',
    placeholder: 'Enter a name',
  },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: 'Example Studio' } };
export const Error: Story = { args: { error: 'Enter a valid name' } };
export const Disabled: Story = {
  args: { defaultValue: 'Example Studio', disabled: true },
};
export const ReadOnly: Story = { args: { defaultValue: 'Example Studio', readOnly: true } };
export const RequiredWithHelp: Story = {
  args: { required: true, description: 'This name appears on published work.' },
};
export const LongContent: Story = {
  args: {
    label: 'Public display name used throughout administration and publishing',
    defaultValue: 'A deliberately long value that must remain readable without breaking the field',
  },
};

export const CompactEditor: Story = { args: { size: 'xs', defaultValue: 'name' } };

export const Code: Story = {
  args: { label: 'Source URL', textRole: 'code', defaultValue: 'https://example.com/source.ts' },
};

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof TextInputPreview>;
export const Playground: PlaygroundStory = {
  render: (args) => <TextInputPreview {...args} />,
  args: { state: 'ready' },
  argTypes: { state: previewStateControl },
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};
export const PlaygroundError: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'error' } };
export const PlaygroundDisabled: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'disabled' } };
