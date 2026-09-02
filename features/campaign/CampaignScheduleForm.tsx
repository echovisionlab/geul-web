'use client';

import { IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import { Divider, Group, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DateTimeInput, type DateTimeValue } from '@/components/core/Input';

export interface CampaignScheduleFormLabels {
  description: string;
  date: string;
  time: string;
  previousMonth: string;
  nextMonth: string;
  hours: string;
  minutes: string;
  audience: string;
  allMatchingUsersWarning: string;
  cancel: string;
  schedule: string;
}

interface CampaignScheduleFormProps {
  locale: string;
  value: DateTimeValue;
  minDate: DateTimeValue;
  audience: string;
  includesUnsubscribedUsers: boolean;
  labels: CampaignScheduleFormLabels;
  loading?: boolean;
  onChange: (value: DateTimeValue) => void;
  onCancel: () => void;
  onSchedule: () => void;
}

export function CampaignScheduleForm({
  locale,
  value,
  minDate,
  audience,
  includesUnsubscribedUsers,
  labels,
  loading = false,
  onChange,
  onCancel,
  onSchedule,
}: CampaignScheduleFormProps) {
  const complete = Boolean(value.date && value.time);

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {labels.description}
      </Text>
      <DateTimeInput
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
      <Text size="sm">{labels.audience.replace('{audience}', audience)}</Text>
      {includesUnsubscribedUsers ? (
        <Alert icon={<IconAlertCircle size={16} />} tone="warning">
          {labels.allMatchingUsersWarning}
        </Alert>
      ) : null}
      <Divider />
      <Group justify="flex-end">
        <Button emphasis="low" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          tone="accent"
          onClick={onSchedule}
          loading={loading}
          disabled={!complete}
          leftSection={<IconCalendar size={16} />}
        >
          {labels.schedule}
        </Button>
      </Group>
    </Stack>
  );
}
