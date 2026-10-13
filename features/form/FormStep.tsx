'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/core/Button';
import { evaluateConditionLogic } from '@/lib/form/build';
import type { FieldValue, FormValues } from '@/lib/types/form/guards';
import type { FormStepSchema } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { FormField } from './FormField/FormField';
import { getFieldKey } from './FormField/utils';

export interface FormStepProps {
  step: FormStepSchema;
  /** Explicit renderer navigation requests focus; passive schema updates do not. */
  navigationRequest?: number;
  navigationLabel?: string;
  headingLevel?: 2 | 3;
  headingAriaLevel?: 2 | 3 | 4;
  values: FormValues;
  phoneDefaultCountry?: string | null;
  onChange: (name: string, value: FieldValue | undefined) => void;
  onStepValidityChange: (isValid: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  isSubmitting: boolean;
}

export function FormStep({
  step,
  navigationRequest = 0,
  navigationLabel,
  headingLevel = 2,
  headingAriaLevel,
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
  const headingId = useId();
  const stepRef = useRef<HTMLElement>(null);
  const previousNavigationRequest = useRef(navigationRequest);
  useEffect(() => {
    if (previousNavigationRequest.current !== navigationRequest) {
      previousNavigationRequest.current = navigationRequest;
      stepRef.current?.focus({ preventScroll: true });
    }
  }, [navigationRequest]);
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
    <DsLayoutStack
      ref={stepRef}
      gap="xl"
      role="group"
      tabIndex={-1}
      aria-labelledby={shouldShowTitle ? headingId : undefined}
      aria-label={shouldShowTitle ? undefined : (stepTitle ?? navigationLabel)}
    >
      {(shouldShowTitle || shouldShowDescription) && (
        <DsLayoutStack gap="xs">
          {shouldShowTitle ? (
            <DsHeading id={headingId} level={headingLevel} aria-level={headingAriaLevel}>
              {parseMarkdown(stepTitle ?? '')}
            </DsHeading>
          ) : null}
          {step.description && (
            <DsText tone="secondary" size="sm">
              {parseMarkdown(step.description)}
            </DsText>
          )}
        </DsLayoutStack>
      )}

      {visibleFields.map((field) => (
        <FormField
          key={field.id}
          field={field}
          disabled={isSubmitting}
          phoneDefaultCountry={phoneDefaultCountry}
          value={values[getFieldKey(field)]}
          onChange={(value) => onChange(getFieldKey(field), value)}
          onValidityChange={(isValid) => handleFieldValidityChange(getFieldKey(field), isValid)}
        />
      ))}

      <DsLayoutInset blockStart="xl">
        <DsLayoutInline justify={isFirst ? 'end' : 'between'}>
          {!isFirst ? (
            <Button tone="neutral" emphasis="low" disabled={isSubmitting} onClick={onPrev}>
              {t('previous')}
            </Button>
          ) : null}
          <Button onClick={onNext} loading={isSubmitting && isLast} disabled={!isStepValid || isSubmitting}>
            {isLast ? t('submit') : t('next')}
          </Button>
        </DsLayoutInline>
      </DsLayoutInset>
    </DsLayoutStack>
  );
}
