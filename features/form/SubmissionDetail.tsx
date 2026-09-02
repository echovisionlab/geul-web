'use client';

import { useMemo, type ReactNode } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { getFieldKey, getFieldLabel } from '@/features/form/FormField/utils';
import type { FormFieldSchema } from '@/lib/types/form/schema';

interface Submission {
  id: string;
  formId: string;
  memberId?: string;
  data: Record<string, unknown>;
  ipAddress?: string;
  countryCode?: string;
  userAgent?: string;
  createdAt?: Date;
}

interface SubmissionDetailProps {
  submission: Submission;
  formId: string;
  deleteButton: ReactNode;
}

export function SubmissionDetail({ submission, deleteButton }: SubmissionDetailProps) {
  const dateTime = useDateTimeFormatter();

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Group>
          <Text size="sm" c="dimmed" w={80}>
            ID
          </Text>
          <Text size="sm" style={{ fontFamily: 'monospace' }}>
            {submission.id}
          </Text>
        </Group>
        {deleteButton}
      </Group>
      <Group>
        <Text size="sm" c="dimmed" w={80}>
          Submitted
        </Text>
        <Text size="sm">
          {submission.createdAt ? `${dateTime.dateTime(submission.createdAt)} (${dateTime.timeZone})` : '-'}
        </Text>
      </Group>
      <Group>
        <Text size="sm" c="dimmed" w={80}>
          Country
        </Text>
        <Text size="sm">{submission.countryCode ?? '-'}</Text>
      </Group>
      <Group>
        <Text size="sm" c="dimmed" w={80}>
          IP
        </Text>
        <Text size="sm">{submission.ipAddress ?? '-'}</Text>
      </Group>
      <Group>
        <Text size="sm" c="dimmed" w={80}>
          User
        </Text>
        <Text size="sm">{submission.memberId ?? 'Anonymous'}</Text>
      </Group>
    </Stack>
  );
}

interface FormSchema {
  id: string;
  name: string;
  steps: Array<{
    id: string;
    title: string;
    fields?: FormFieldSchema[];
  }>;
}

interface ResponsesProps {
  data: Record<string, unknown>;
  schema: FormSchema;
}

function Responses({ data, schema }: ResponsesProps) {
  const dateTime = useDateTimeFormatter();

  // Build field map from schema
  const fieldMap = useMemo(() => {
    const map = new Map<string, FormFieldSchema>();
    for (const step of schema.steps) {
      for (const field of step.fields ?? []) {
        map.set(field.id, field);
        map.set(getFieldKey(field), field);
      }
    }
    return map;
  }, [schema]);

  const renderValue = (fieldId: string, value: unknown): ReactNode => {
    const field = fieldMap.get(fieldId);

    if (value === null || value === undefined || value === '') {
      return (
        <Text size="sm" c="dimmed">
          -
        </Text>
      );
    }

    // Boolean types (checkbox, switch)
    if (field?.type === 'checkbox' || field?.type === 'switch') {
      const checked = value === true;
      return checked ? (
        <IconCheck size={16} color="var(--mantine-color-green-6)" />
      ) : (
        <IconX size={16} color="var(--mantine-color-gray-6)" />
      );
    }

    // Date
    if (field?.type === 'date' && typeof value === 'string') {
      try {
        return <Text size="sm">{dateTime.date(value)}</Text>;
      } catch {
        return <Text size="sm">{value}</Text>;
      }
    }

    // Select - show label instead of value
    if (field?.type === 'select' && typeof value === 'string') {
      const option = field.options.find((o) => o.value === value);
      return <LabelBadge>{option?.label ?? value}</LabelBadge>;
    }

    // Multiselect - show labels
    if (field?.type === 'multiselect' && Array.isArray(value)) {
      return (
        <Group gap="xs">
          {value.map((v, i) => {
            const option = field.options.find((o) => o.value === v);
            return <LabelBadge key={i}>{option?.label ?? v}</LabelBadge>;
          })}
        </Group>
      );
    }

    // Phone
    if (typeof value === 'object' && 'countryCode' in value && 'nationalNumber' in value) {
      const phone = value as { countryCode: string; nationalNumber: string };
      return (
        <Text size="sm">
          +{phone.countryCode} {phone.nationalNumber}
        </Text>
      );
    }

    // Array (fallback)
    if (Array.isArray(value)) {
      return <Text size="sm">{value.join(', ')}</Text>;
    }

    // Object (fallback)
    if (typeof value === 'object') {
      return (
        <Text size="sm" style={{ fontFamily: 'monospace' }}>
          {JSON.stringify(value)}
        </Text>
      );
    }

    // Default
    return <Text size="sm">{String(value)}</Text>;
  };

  // Get ordered fields from schema
  const orderedFields: { id: string; name: string; value: unknown }[] = [];
  for (const step of schema.steps) {
    for (const field of step.fields ?? []) {
      const fieldKey = getFieldKey(field);
      if (fieldKey in data) {
        orderedFields.push({
          id: fieldKey,
          name: getFieldLabel(field),
          value: data[fieldKey],
        });
        continue;
      }
      if (field.id in data) {
        orderedFields.push({
          id: field.id,
          name: getFieldLabel(field),
          value: data[field.id],
        });
      }
    }
  }
  // Add any remaining fields not in schema
  for (const [key, value] of Object.entries(data)) {
    if (!orderedFields.find((f) => f.id === key)) {
      orderedFields.push({ id: key, name: key, value });
    }
  }

  return (
    <Stack gap="xs">
      {orderedFields.map(({ id, name, value }) => (
        <Group key={id} justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
            {name}
          </Text>
          {renderValue(id, value)}
        </Group>
      ))}
      {orderedFields.length === 0 && (
        <Text size="sm" c="dimmed">
          No data
        </Text>
      )}
    </Stack>
  );
}

SubmissionDetail.Responses = Responses;
