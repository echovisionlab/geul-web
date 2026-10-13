import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { createStorybookText, localizeFixtureArgs, useStorybookText } from '@/.storybook/fixture-i18n';
import { loadClientMessagesForLocale } from '@/lib/i18n/client-message-loaders';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { PinInput, type PinInputProps } from './PinInput';
import { LayoutContainer } from '../Layout';

const meta = {
  title: 'Core/Input/PinInput',
  component: PinInput,
  parameters: { layout: 'centered' },
  argTypes: { align: { control: 'select', options: ['start', 'center', 'end'] } },
  args: {
    length: 6,
    ariaLabel: 'Verification code',
  },
} satisfies Meta<typeof PinInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: '482193' } };
export const Masked: Story = { args: { mask: true } };
export const Invalid: Story = { args: { error: true } };
export const Disabled: Story = { args: { defaultValue: '482193', disabled: true } };
export const Centered: Story = {
  args: { align: 'center' },
  render: (args) => (
    <LayoutContainer size="form" inset="none">
      <PinInput {...args} />
    </LayoutContainer>
  ),
};

function RecoveryPreview(args: PinInputProps) {
  const text = useStorybookText();
  return <PinInput {...localizeFixtureArgs(args, text)} />;
}

export const LabelledRecovery: Story = {
  tags: ['a11y-smoke'],
  args: {
    label: 'Verification code',
    description: 'Enter the verification code from your email to continue.',
    error: 'This code has expired.',
    required: true,
  },
  render: (args) => <RecoveryPreview {...args} />,
  play: async ({ canvasElement, args, globals }) => {
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const text = createStorybookText(locale, await loadClientMessagesForLocale(locale));
    const localized = localizeFixtureArgs(args, text);
    const name = String(localized.label);
    const description = `${localized.description} ${localized.error}`;
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name })).toBeInTheDocument();
    for (let index = 1; index <= 6; index++) {
      const input = canvas.getByRole('textbox', { name: `${name} ${index}` });
      await expect(input).toHaveAccessibleDescription(description);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
    }
    const first = canvas.getByRole('textbox', { name: `${name} 1` });
    await userEvent.click(first);
    await userEvent.paste('123456');
    await expect(canvas.getByRole('textbox', { name: `${name} 6` })).toHaveFocus();
    await expect(canvas.getByRole('textbox', { name: `${name} 6` })).toHaveValue('6');
    await userEvent.keyboard('{ArrowLeft}{Backspace}');
    await expect(canvas.getByRole('textbox', { name: `${name} 5` })).toHaveFocus();
    await expect(canvas.getByRole('textbox', { name: `${name} 5` })).toHaveValue('');
  },
};
