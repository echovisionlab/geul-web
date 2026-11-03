'use client';
import { SupportingText, Code } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/core/Progress';
import { ContentModal } from '@/components/core/Modal';
import { useDisclosure } from '@mantine/hooks';
import type { FieldValue, FormValues } from '@/lib/types/form/guards';
import type { BuiltForm } from '@/lib/types/form/model';
import { loadPhoneField } from './FormField/load-phone-field';
import { getFieldKey } from './FormField/utils';
import { FormStep } from './FormStep';
interface FormRendererProps<T extends FormValues = FormValues> {
  form: BuiltForm<T>;
  onSubmit?: (values: T) => void | Promise<void>;
  previewMode?: boolean;
  phoneDefaultCountry?: string | null;
  stepHeadingLevel?: 2 | 3;
  stepHeadingAriaLevel?: 2 | 3 | 4;
}
export function FormRenderer<T extends FormValues = FormValues>({
  form,
  onSubmit,
  previewMode = false,
  phoneDefaultCountry,
  stepHeadingLevel = 2,
  stepHeadingAriaLevel,
}: FormRendererProps<T>) {
  const tModalActions = useTranslations('common.actions');
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
  const [navigationRequest, setNavigationRequest] = useState(0);
  const [values, setValues] = useState<T>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false);
  const hasPhoneField = form.schema.steps.some((step) => (step.fields ?? []).some((field) => field.type === 'tel'));
  // Start loading the phone field (and `libphonenumber-js`) before a later step shows it.
  useEffect(() => {
    if (hasPhoneField) {
      void loadPhoneField().catch(() => {
        /* The visible field owns retry. */
      });
    }
  }, [hasPhoneField]);
  // Memoize visible steps to prevent unnecessary recalculations
  const visibleSteps = useMemo(() => form.getVisibleSteps(values), [form, values]);
  const effectiveStepIndex = Math.min(currentStepIndex, Math.max(visibleSteps.length - 1, 0));
  const currentStep = visibleSteps[effectiveStepIndex];
  const progress = visibleSteps.length > 0 ? ((effectiveStepIndex + 1) / visibleSteps.length) * 100 : 0;
  // Adjust currentStepIndex if it goes out of bounds when steps change
  useEffect(() => {
    if (currentStepIndex >= visibleSteps.length && visibleSteps.length > 0) {
      setCurrentStepIndex(visibleSteps.length - 1);
    }
  }, [visibleSteps.length, currentStepIndex]);
  const setFieldValue = useCallback((name: string, value: FieldValue | undefined) => {
    setValues((prev) => {
      const next: Record<string, FieldValue> = { ...prev };
      if (value === undefined) {
        delete next[name];
      } else {
        next[name] = value;
      }
      return next as T;
    });
  }, []);
  const goToNext = useCallback(async () => {
    if (!currentStep || !isCurrentStepValid || isSubmitting) {
      return;
    }
    if (effectiveStepIndex < visibleSteps.length - 1) {
      setCurrentStepIndex(effectiveStepIndex + 1);
      setNavigationRequest((request) => request + 1);
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
    effectiveStepIndex,
    visibleSteps.length,
    isCurrentStepValid,
    isSubmitting,
    values,
    onSubmit,
    previewMode,
    openPreviewModal,
  ]);
  const goToPrev = useCallback(() => {
    if (effectiveStepIndex > 0) {
      setCurrentStepIndex(effectiveStepIndex - 1);
      setNavigationRequest((request) => request + 1);
    }
  }, [effectiveStepIndex]);
  if (!currentStep) {
    return null;
  }
  return (
    <>
      <DsLayoutStack
        gap="xl"
        aria-busy={isSubmitting}
        onKeyDown={(event) => {
          // Text-field submission is local to this renderer. Menus, buttons,
          // multiline inputs, IME composition and other forms own their keys.
          if (
            event.defaultPrevented ||
            event.key !== 'Enter' ||
            event.shiftKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.nativeEvent.isComposing ||
            !isCurrentStepValid ||
            isSubmitting ||
            !(event.target instanceof HTMLInputElement) ||
            !['text', 'email', 'tel', 'number'].includes(event.target.type) ||
            event.target.getAttribute('role') === 'combobox'
          ) {
            return;
          }
          event.preventDefault();
          void goToNext();
        }}
      >
        {visibleSteps.length > 1 ? (
          <Progress
            value={progress}
            size="sm"
            aria-label={t('progressAria', {
              current: effectiveStepIndex + 1,
              total: visibleSteps.length,
            })}
          />
        ) : null}

        <FormStep
          step={currentStep}
          navigationRequest={navigationRequest}
          navigationLabel={t('progressAria', { current: effectiveStepIndex + 1, total: visibleSteps.length })}
          headingLevel={stepHeadingLevel}
          headingAriaLevel={stepHeadingAriaLevel}
          values={values}
          phoneDefaultCountry={phoneDefaultCountry}
          onChange={setFieldValue}
          onStepValidityChange={setIsCurrentStepValid}
          onNext={goToNext}
          onPrev={goToPrev}
          isFirst={effectiveStepIndex === 0}
          isLast={effectiveStepIndex === visibleSteps.length - 1}
          isSubmitting={isSubmitting}
        />
      </DsLayoutStack>

      <ContentModal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title={t('preview.title')}
        size="large"
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack gap="md">
          <SupportingText tone="secondary">{t('preview.description')}</SupportingText>
          <Code block scroll="standard" wrap="anywhere">
            {JSON.stringify(values, null, 2)}
          </Code>
        </DsLayoutStack>
      </ContentModal>
    </>
  );
}
