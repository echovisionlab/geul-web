import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { expect, within } from 'storybook/test';

import { DateTimeInput, type DateTimeInputProps } from './DateTimeInput';

type PreviewProps = Omit<
  DateTimeInputProps,
  'locale' | 'dateLabel' | 'timeLabel' | 'previousLabel' | 'nextLabel' | 'hoursLabel' | 'minutesLabel'
>;

function LocalizedDateTimeInput(args: PreviewProps) {
  const locale = useLocale();
  const t = useTranslations('postEditor.schedule');
  const labels = useTranslations('common.labels');
  return (
    <DateTimeInput
      {...args}
      locale={locale}
      dateLabel={t('date')}
      timeLabel={t('time')}
      previousLabel={t('previousPeriod')}
      nextLabel={t('nextPeriod')}
      hoursLabel={labels('hours')}
      minutesLabel={labels('minutes')}
    />
  );
}

const meta: Meta<typeof LocalizedDateTimeInput> = {
  title: 'Core/Input/DateTimeInput',
  component: LocalizedDateTimeInput,
  tags: ['date-time-ui'],
  parameters: { layout: 'centered' },
  args: {
    defaultValue: { date: '2026-08-05', time: '20:46' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const segments = canvas.getAllByRole('spinbutton');
    await expect(segments).toHaveLength(5);
    for (const segment of segments) {
      const target = segment.getBoundingClientRect();
      await expect(target.width).toBeGreaterThanOrEqual(24);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
  },
};

export default meta;
type Story = StoryObj<typeof LocalizedDateTimeInput>;

export const Default: Story = {};

export const Required: Story = {
  args: { required: true },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
};
