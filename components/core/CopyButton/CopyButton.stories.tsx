import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { TextInput } from '../Input';
import { LayoutInline } from '../Layout';
import { CopyButton } from './CopyButton';

const meta = {
  title: 'Core/Actions/CopyButton',
  component: CopyButton,
  parameters: { layout: 'centered' },
  args: { value: 'https://studio.example.com/works/example', label: 'Copy URL', copiedLabel: 'Copied' },
} satisfies Meta<typeof CopyButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Press to write the value; the glyph turns into a positive check and the result is announced. */
export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
export const Disabled: Story = { args: { disabled: true } };
export const InFieldSection: Story = {
  render: localizedRender((args) => (
    <TextInput
      label="Public URL"
      textRole="code"
      value={String(args.value)}
      readOnly
      size="sm"
      rightSection={<CopyButton {...args} size="sm" />}
    />
  )),
};
export const BesideIdentifier: Story = {
  render: localizedRender(() => (
    <LayoutInline gap="xs">
      <code>usr_profile_1</code>
      <CopyButton value="usr_profile_1" label="Copy UID" copiedLabel="Copied" />
    </LayoutInline>
  )),
};
