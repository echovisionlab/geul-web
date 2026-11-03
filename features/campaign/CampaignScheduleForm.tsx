'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { IconAlertCircle, IconCalendar } from '@tabler/icons-react';

import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DateTimeInput, type DateTimeValue } from '@/components/core/Input/DateTimeInput';

export interface CampaignScheduleFormLabels {
  description: string;
  date: string;
  time: string;
  previousMonth: string;
  nextMonth: string;
  hours: string;
  minutes: string;
  criteria: string;
  allMatchingUsersWarning: string;
  cancel: string;
  schedule: string;
}

interface CampaignScheduleFormProps {
  locale: string;
  value: DateTimeValue;
  minDate: DateTimeValue;
  criteria: string;
  includesUnsubscribedUsers: boolean;
  labels: CampaignScheduleFormLabels;
  loading?: boolean;
  disabled?: boolean;
  onChange: (value: DateTimeValue) => void;
  onCancel: () => void;
  onSchedule: () => void;
}

export function CampaignScheduleForm({
  locale,
  value,
  minDate,
  criteria,
  includesUnsubscribedUsers,
  labels,
  loading = false,
  disabled = false,
  onChange,
  onCancel,
  onSchedule,
}: CampaignScheduleFormProps) {
  const complete = Boolean(value.date && value.time);

  return (
    <DsLayoutStack>
      <SupportingText tone="secondary">{labels.description}</SupportingText>
      <DateTimeInput
        disabled={disabled}
        locale={locale}
        dateLabel={labels.date}
        timeLabel={labels.time}
        previousLabel={labels.previousMonth}
        nextLabel={labels.nextMonth}
        hoursLabel={labels.hours}
        minutesLabel={labels.minutes}
        value={value}
        minDate={minDate}
        onChange={onChange}
        required
      />
      <DsText size="sm">{labels.criteria.replace('{criteria}', criteria)}</DsText>
      {includesUnsubscribedUsers ? (
        <Alert icon={<IconAlertCircle size={16} />} tone="warning">
          {labels.allMatchingUsersWarning}
        </Alert>
      ) : null}
      <DsLayoutInline justify="end">
        <Button emphasis="low" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          emphasis="medium"
          tone="neutral"
          onClick={onSchedule}
          loading={loading}
          disabled={disabled || !complete}
          leftSection={<IconCalendar size={16} />}
        >
          {labels.schedule}
        </Button>
      </DsLayoutInline>
    </DsLayoutStack>
  );
}
