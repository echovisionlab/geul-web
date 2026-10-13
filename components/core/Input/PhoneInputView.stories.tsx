import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { expect, userEvent, within } from 'storybook/test';
import { PhoneInputView } from './PhoneInputView';

const countries = [
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81' },
];

const meta: Meta<typeof PhoneInputView> = {
  title: 'Core/Input/PhoneInputView',
  component: PhoneInputView,
  parameters: { layout: 'padded' },
  render: function PhonePreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <PhoneInputView
        {...args}
        onCountryChange={(countryCode) => updateArgs({ countryCode })}
        onValueChange={(value) => updateArgs({ value })}
      />
    );
  },
  args: {
    label: 'Phone number',
    countries,
    countryCode: 'KR',
    value: '010-2000-0000',
    phonePlaceholder: '010-2000-0000',
    labels: {
      countryName: 'Country',
      searchPlaceholder: 'Search countries',
      noResults: 'No countries found',
    },
    onCountryChange: () => {},
    onValueChange: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof PhoneInputView>;

export const Default: Story = {};

export const Error: Story = {
  args: {
    error: 'Enter a valid phone number.',
  },
};

export const CountryKeyboardSelection: Story = {
  tags: ['a11y-smoke'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const country = canvas.getByRole('combobox', { name: 'Country Search countries' });
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('010-2000-0000');
    await userEvent.click(country);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(country).toHaveFocus();
    await expect(country).toHaveAttribute('aria-expanded', 'false');
  },
};
