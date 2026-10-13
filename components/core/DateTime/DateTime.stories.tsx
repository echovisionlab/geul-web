import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale } from 'next-intl';
import { DateTime, type DateTimeProps } from './DateTime';

function LocalizedDateTime(args: Omit<DateTimeProps, 'locale'>) {
  const locale = useLocale();
  return <DateTime {...args} locale={locale} />;
}

const meta = {
  title: 'Core/Data Display/DateTime',
  component: LocalizedDateTime,
  args: {
    value: '2026-03-06T07:24:00.000Z',
    timeZone: 'Asia/Seoul',
  },
} satisfies Meta<typeof LocalizedDateTime>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Date: Story = {};

export const DateAndTime: Story = {
  args: {
    display: 'dateTime',
  },
};

export const DomainTimeZone: Story = {
  args: {
    display: 'dateTime',
    timeZone: 'America/New_York',
  },
};
