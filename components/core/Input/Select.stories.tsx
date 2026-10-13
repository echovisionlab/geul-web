import { SelectPreview } from '@/stories/shared/PrimitiveInputPreviews';
import { previewStateControl } from '@/stories/shared/PreviewFrame';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Select } from './Select';

const data = ['Draft', 'Published', 'Archived'];

const meta = {
  title: 'Core/Input/Select',
  component: Select,
  parameters: { layout: 'centered' },
  args: {
    label: 'Status',
    placeholder: 'Choose a status',
    data,
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: 'Published' } };
export const Searchable: Story = { args: { searchable: true } };
export const Error: Story = { args: { error: 'Choose a status' } };
export const Disabled: Story = { args: { defaultValue: 'Archived', disabled: true } };
export const ReadOnly: Story = { args: { defaultValue: 'Published', readOnly: true, clearable: true } };

export const CompactEditor: Story = { args: { size: 'xs', defaultDropdownOpened: true } };

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof SelectPreview>;
export const Playground: PlaygroundStory = {
  render: (args) => <SelectPreview {...args} />,
  args: { state: 'ready' },
  argTypes: { state: previewStateControl },
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};
export const PlaygroundError: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'error' } };
export const PlaygroundDisabled: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'disabled' } };
