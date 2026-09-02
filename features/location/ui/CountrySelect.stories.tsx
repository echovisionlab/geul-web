import type { Meta, StoryObj } from '@storybook/nextjs';

import { CountrySelect } from './CountrySelect';

const options = [
  {
    value: 'KR',
    label: 'South Korea',
    code: 'KR',
    name: 'South Korea',
    nativeName: '대한민국',
  },
  {
    value: 'JP',
    label: 'Japan',
    code: 'JP',
    name: 'Japan',
    nativeName: '日本',
  },
  {
    value: 'TW',
    label: 'Taiwan',
    code: 'TW',
    name: 'Taiwan',
    nativeName: '台灣',
  },
];

const meta: Meta<typeof CountrySelect> = {
  title: 'Feature/Location/CountrySelect',
  component: CountrySelect,
  parameters: { layout: 'centered' },
  args: {
    options,
    noResultsLabel: 'No results found',
    label: 'Country',
    placeholder: 'Choose a country',
    searchable: true,
    clearable: true,
    w: 320,
    onChange: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof CountrySelect>;

export const Empty: Story = {};
export const Selected: Story = { args: { value: 'KR' } };
export const Disabled: Story = { args: { value: 'KR', disabled: true } };

export const Selection: Story = {};
