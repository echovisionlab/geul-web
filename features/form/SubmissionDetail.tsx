'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { IconCheck, IconX } from '@tabler/icons-react';

import { LabelBadge } from '@/components/core/Badge';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { getFieldKey, getFieldLabel } from '@/features/form/FormField/utils';
import type { FormFieldSchema, FormSchema as StoredFormSchema } from '@/lib/types/form/schema';
import { StatusIcon } from '@/components/core/Display';

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
    <DsLayoutStack gap="xs">
      <DsLayoutInline justify="between">
        <DsLayoutInline>
          <div style={{ width: 80 }}>
            <DsText size="sm" tone="secondary">
              ID
            </DsText>
          </div>
          <DsText font="mono" size="sm">
            {submission.id}
          </DsText>
        </DsLayoutInline>
        {deleteButton}
      </DsLayoutInline>
      <DsLayoutInline>
        <div style={{ width: 80 }}>
          <DsText size="sm" tone="secondary">
            Submitted
          </DsText>
        </div>
        <DsText size="sm">
          {submission.createdAt ? `${dateTime.dateTime(submission.createdAt)} (${dateTime.timeZone})` : '-'}
        </DsText>
      </DsLayoutInline>
      <DsLayoutInline>
        <div style={{ width: 80 }}>
          <DsText size="sm" tone="secondary">
            Country
          </DsText>
        </div>
        <DsText size="sm">{submission.countryCode ?? '-'}</DsText>
      </DsLayoutInline>
      <DsLayoutInline>
        <div style={{ width: 80 }}>
          <DsText size="sm" tone="secondary">
            IP
          </DsText>
        </div>
        <DsText size="sm">{submission.ipAddress ?? '-'}</DsText>
      </DsLayoutInline>
      <DsLayoutInline>
        <div style={{ width: 80 }}>
          <DsText size="sm" tone="secondary">
            User
          </DsText>
        </div>
        <DsText size="sm">{submission.memberId ?? 'Anonymous'}</DsText>
      </DsLayoutInline>
    </DsLayoutStack>
  );
}

type FormSchema = StoredFormSchema & { name?: string };

interface ResponsesProps {
  data: Record<string, unknown>;
  schema: FormSchema;
}

function Responses({ data, schema }: ResponsesProps) {
  const t = useTranslations('formAdmin.builder.conditions');
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
        <DsText size="sm" tone="secondary">
          -
        </DsText>
      );
    }

    // Boolean types (checkbox, switch)
    if (field?.type === 'checkbox' || field?.type === 'switch') {
      const checked = value === true;
      return checked ? (
        <StatusIcon icon={IconCheck} tone="positive" label={t('trueOption')} />
      ) : (
        <StatusIcon icon={IconX} tone="neutral" label={t('falseOption')} />
      );
    }

    // Date
    if (field?.type === 'date' && typeof value === 'string') {
      try {
        return <DsText size="sm">{dateTime.date(value)}</DsText>;
      } catch {
        return <DsText size="sm">{value}</DsText>;
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
        <DsLayoutInline gap="xs">
          {value.map((v, i) => {
            const option = field.options.find((o) => o.value === v);
            return <LabelBadge key={i}>{option?.label ?? v}</LabelBadge>;
          })}
        </DsLayoutInline>
      );
    }

    // Phone
    if (typeof value === 'object' && 'countryCode' in value && 'nationalNumber' in value) {
      const phone = value as { countryCode: string; nationalNumber: string };
      return (
        <DsText size="sm">
          +{phone.countryCode} {phone.nationalNumber}
        </DsText>
      );
    }

    // Array (fallback)
    if (Array.isArray(value)) {
      return <DsText size="sm">{value.join(', ')}</DsText>;
    }

    // Object (fallback)
    if (typeof value === 'object') {
      return (
        <DsText font="mono" size="sm">
          {JSON.stringify(value)}
        </DsText>
      );
    }

    // Default
    return <DsText size="sm">{String(value)}</DsText>;
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
    <DsLayoutStack gap="xs">
      {orderedFields.map(({ id, name, value }) => (
        <DsLayoutInline key={id} role="group" aria-label={name} justify="between" align="start">
          <div style={{ minWidth: 120 }}>
            <DsText size="sm" tone="secondary">
              {name}
            </DsText>
          </div>
          {renderValue(id, value)}
        </DsLayoutInline>
      ))}
      {orderedFields.length === 0 && <SupportingText tone="secondary">No data</SupportingText>}
    </DsLayoutStack>
  );
}

SubmissionDetail.Responses = Responses;
