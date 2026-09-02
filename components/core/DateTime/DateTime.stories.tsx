import type { Meta, StoryObj } from '@storybook/react';
import { DateTime } from './DateTime';

const meta = {
  title: 'Core/DateTime',
  component: DateTime,
  args: {
    value: '2026-03-06T07:24:00.000Z',
    locale: 'en',
    timeZone: 'Asia/Seoul',
  },
} satisfies Meta<typeof DateTime>;

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
