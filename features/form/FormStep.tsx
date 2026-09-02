'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text, Title } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { evaluateConditionLogic } from '@/lib/form/build';
import type { FieldValue, FormValues } from '@/lib/types/form/guards';
import type { FormStepSchema } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { FormField } from './FormField/FormField';
import { getFieldKey } from './FormField/utils';

export interface FormStepProps {
  step: FormStepSchema;
  values: FormValues;
  phoneDefaultCountry?: string | null;
  onChange: (name: string, value: FieldValue) => void;
  onStepValidityChange: (isValid: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  isSubmitting: boolean;
}

export function FormStep({
  step,
  values,
  phoneDefaultCountry,
  onChange,
  onStepValidityChange,
  onNext,
  onPrev,
  isFirst,
  isLast,
  isSubmitting,
}: FormStepProps) {
  const t = useTranslations('publicForm.navigation');
  const allFields = step.fields ?? [];
  const stepTitle = step.title?.trim() ? step.title : undefined;
  const shouldShowTitle = step.showTitle !== false && !!stepTitle;
  const shouldShowDescription = !!step.description;

  // Filter fields by condition
  const visibleFields = useMemo(() => {
    return allFields.filter(
      (field) =>
        !field.condition ||
        evaluateConditionLogic(
          field.condition,
          values,
          new Map(allFields.map((candidate) => [candidate.id, getFieldKey(candidate)])),
        ),
    );
  }, [allFields, values]);

  // FormStep collects field validity
  const [fieldValidity, setFieldValidity] = useState<Record<string, boolean | null>>({});

  // Reset field validity when step changes
  useEffect(() => {
    setFieldValidity({});
  }, [step.id]);

  const handleFieldValidityChange = useCallback((name: string, isValid: boolean | null) => {
    setFieldValidity((prev) => ({ ...prev, [name]: isValid }));
  }, []);

  // Compute step validity (only for visible fields)
  const isStepValid = useMemo(() => {
    if (visibleFields.length === 0) {
      return true;
    }
    return visibleFields.every((f) => fieldValidity[getFieldKey(f)] === true);
  }, [visibleFields, fieldValidity]);

  // Report step validity changes to parent
  const onStepValidityChangeRef = useRef(onStepValidityChange);
  useEffect(() => {
    onStepValidityChangeRef.current = onStepValidityChange;
  });

  useEffect(() => {
    onStepValidityChangeRef.current(isStepValid);
  }, [isStepValid]);

  return (
    <Stack gap="xl">
      {(shouldShowTitle || shouldShowDescription) && (
        <Stack gap="xs">
          {shouldShowTitle ? <Title order={2}>{parseMarkdown(stepTitle ?? '')}</Title> : null}
          {step.description && (
            <Text c="dimmed" size="lg">
              {parseMarkdown(step.description)}
            </Text>
          )}
        </Stack>
      )}

      {visibleFields.map((field) => (
        <FormField
          key={field.id}
          field={field}
          phoneDefaultCountry={phoneDefaultCountry}
          value={values[getFieldKey(field)]}
          onChange={(value) => onChange(getFieldKey(field), value)}
          onValidityChange={(isValid) => handleFieldValidityChange(getFieldKey(field), isValid)}
        />
      ))}

      <Group justify={isFirst ? 'flex-end' : 'space-between'} mt="xl">
        {!isFirst ? (
          <Button tone="neutral" emphasis="low" onClick={onPrev}>
            {t('previous')}
          </Button>
        ) : null}
        <Button onClick={onNext} loading={isSubmitting && isLast} disabled={!isStepValid}>
          {isLast ? t('submit') : t('next')}
        </Button>
      </Group>
    </Stack>
  );
}
