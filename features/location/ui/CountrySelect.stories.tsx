import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
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
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return <CountrySelect {...args} onChange={(value) => updateArgs({ value })} />;
  },
  decorators: [
    withFeatureLabels({
      project: (args, t, locale) => ({
        label: t('common.labels.country'),
        placeholder: t('common.placeholders.selectValues'),
        noResultsLabel: t('searchCombobox.noResults'),
        options: (args.options as typeof options).map((option) => ({
          ...option,
          label: new Intl.DisplayNames([locale], { type: 'region' }).of(option.code) ?? option.name,
          name: new Intl.DisplayNames([locale], { type: 'region' }).of(option.code) ?? option.name,
        })),
      }),
    }),
  ],
  parameters: { layout: 'centered' },
  args: {
    options,
    noResultsLabel: 'No results found',
    label: 'Country',
    placeholder: 'Choose a country',
    searchable: true,
    clearable: true,
    onChange: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof CountrySelect>;

export const Empty: Story = {};
export const Selected: Story = { args: { value: 'KR' } };
export const Disabled: Story = { args: { value: 'KR', disabled: true } };
