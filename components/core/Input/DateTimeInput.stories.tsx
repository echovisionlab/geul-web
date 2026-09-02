import type { Meta, StoryObj } from '@storybook/nextjs';

import { DateTimeInput } from './DateTimeInput';

const meta: Meta<typeof DateTimeInput> = {
  title: 'Core/Input/DateTimeInput',
  component: DateTimeInput,
  tags: ['date-time-ui'],
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    dateLabel: 'Date',
    timeLabel: 'Time',
    previousLabel: 'Previous month',
    nextLabel: 'Next month',
    hoursLabel: 'Hours',
    minutesLabel: 'Minutes',
    value: { date: '2026-08-05', time: '20:46' },
    onChange: () => {},
  },
  render: (args) => <DateTimeInput {...args} w={320} />,
};

export default meta;
type Story = StoryObj<typeof DateTimeInput>;

export const Default: Story = {};

export const Korean: Story = {
  args: {
    locale: 'ko',
    dateLabel: '날짜',
    timeLabel: '시각',
    previousLabel: '이전 달',
    nextLabel: '다음 달',
    hoursLabel: '시간',
    minutesLabel: '분',
  },
  globals: { locale: 'ko' },
};

export const Narrow: Story = {
  args: {
    locale: 'ja',
    dateLabel: '日付',
    timeLabel: '時刻',
    previousLabel: '前の月',
    nextLabel: '次の月',
    hoursLabel: '時間',
    minutesLabel: '分',
  },
  globals: { locale: 'ja' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
