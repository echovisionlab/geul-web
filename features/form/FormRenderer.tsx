'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Code, Modal, Progress, Stack, Text } from '@mantine/core';
import { useDisclosure, useWindowEvent } from '@mantine/hooks';
import type { FieldValue, FormValues } from '@/lib/types/form/guards';
import type { BuiltForm } from '@/lib/types/form/model';
import { getFieldKey } from './FormField/utils';
import { FormStep } from './FormStep';

interface FormRendererProps<T extends FormValues = FormValues> {
  form: BuiltForm<T>;
  onSubmit?: (values: T) => void | Promise<void>;
  previewMode?: boolean;
  phoneDefaultCountry?: string | null;
}

export function FormRenderer<T extends FormValues = FormValues>({
  form,
  onSubmit,
  previewMode = false,
  phoneDefaultCountry,
}: FormRendererProps<T>) {
  const t = useTranslations('formRenderer');
  const initialValues = (): T => {
    const values: Record<string, unknown> = {};
    for (const step of form.schema.steps) {
      for (const field of step.fields ?? []) {
        if (field.defaultValue !== undefined) {
          values[getFieldKey(field)] = field.defaultValue;
        }
      }
    }
    return values as T;
  };

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [values, setValues] = useState<T>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false);

  // Memoize visible steps to prevent unnecessary recalculations
  const visibleSteps = useMemo(() => form.getVisibleSteps(values), [form, values]);

  const currentStep = visibleSteps[currentStepIndex];
  const progress = visibleSteps.length > 0 ? ((currentStepIndex + 1) / visibleSteps.length) * 100 : 0;

  // Adjust currentStepIndex if it goes out of bounds when steps change
  useEffect(() => {
    if (currentStepIndex >= visibleSteps.length && visibleSteps.length > 0) {
      setCurrentStepIndex(visibleSteps.length - 1);
    }
  }, [visibleSteps.length, currentStepIndex]);

  const setFieldValue = useCallback((name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }) as T);
  }, []);

  const goToNext = useCallback(async () => {
    if (!currentStep || !isCurrentStepValid || isSubmitting) {
      return;
    }

    if (currentStepIndex < visibleSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else if (previewMode) {
      openPreviewModal();
    } else {
      setIsSubmitting(true);
      try {
        await onSubmit?.(values);
      } catch {
        // The submit surface is responsible for user-facing error handling.
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [
    currentStep,
    currentStepIndex,
    visibleSteps.length,
    isCurrentStepValid,
    isSubmitting,
    values,
    onSubmit,
    previewMode,
    openPreviewModal,
  ]);

  const goToPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  useWindowEvent('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || !isCurrentStepValid || isSubmitting) {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement?.tagName !== 'TEXTAREA') {
      event.preventDefault();
      goToNext();
    }
  });

  if (!currentStep) {
    return null;
  }

  return (
    <>
      <Stack gap="xl">
        {visibleSteps.length > 1 ? (
          <Progress
            value={progress}
            size="sm"
            aria-label={t('progressAria', {
              current: currentStepIndex + 1,
              total: visibleSteps.length,
            })}
          />
        ) : null}

        <FormStep
          step={currentStep}
          values={values}
          phoneDefaultCountry={phoneDefaultCountry}
          onChange={setFieldValue}
          onStepValidityChange={setIsCurrentStepValid}
          onNext={goToNext}
          onPrev={goToPrev}
          isFirst={currentStepIndex === 0}
          isLast={currentStepIndex === visibleSteps.length - 1}
          isSubmitting={isSubmitting}
        />
      </Stack>

      <Modal opened={previewModalOpened} onClose={closePreviewModal} title={t('preview.title')} size="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('preview.description')}
          </Text>
          <Code block style={{ maxHeight: 400, overflow: 'auto' }}>
            {JSON.stringify(values, null, 2)}
          </Code>
        </Stack>
      </Modal>
    </>
  );
}
