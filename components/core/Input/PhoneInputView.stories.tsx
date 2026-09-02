import type { Meta, StoryObj } from '@storybook/nextjs';

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
  args: {
    label: 'Phone number',
    countries,
    countryCode: 'KR',
    value: '010-2000-0000',
    phonePlaceholder: '010-2000-0000',
    labels: {
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
