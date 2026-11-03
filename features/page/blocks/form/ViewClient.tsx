'use client';
import { SupportingText, Heading as DsHeading } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { ProcessingOverlay } from '@/components/core/LoadingSurface';

import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { PasswordInput } from '@/components/core/Input';
import { FormAccessBoundary } from '@/features/form/FormAccessBoundary';
import { FormRenderer } from '@/features/form/FormRenderer';
import { FormSubmissionPendingState, FormSubmissionSuccessState } from '@/features/form/FormSubmissionState';
import { resolvePhoneDefaultCountryCode } from '@/features/form/phone-default-country';
import { useFormValidationMessages } from '@/features/form/useFormValidationMessages';
import { checkFormAccessAction, submitFormAction } from '@/lib/actions/form';
import { buildForm } from '@/lib/form/build';
import type { FormValues } from '@/lib/types/form/guards';
import type { FormProps } from './schema';
interface FormViewClientProps {
  props: FormProps;
  requestedLocale?: string;
  preview?: boolean;
}
export function FormViewClient({ props, requestedLocale, preview = false }: FormViewClientProps) {
  const tEmbeddedForm = useTranslations('embeddedForm');
  const tCommonActions = useTranslations('common.actions');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tFormAccess = useTranslations('formAccess');
  const validationMessages = useFormValidationMessages();
  const { formId, showTitle } = props;
  const [submitted, setSubmitted] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string>();
  const [passwordError, setPasswordError] = useState(false);
  const {
    data: accessData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['form', 'embed-access', formId, submittedPassword, requestedLocale],
    queryFn: () =>
      checkFormAccessAction({
        slug: formId,
        context: 'embed',
        password: submittedPassword,
        requestedLocale,
      }),
    enabled: !!formId,
  });
  useEffect(() => {
    if (!submittedPassword) {
      return;
    }
    if (accessData?.accessible) {
      setPasswordError(false);
      return;
    }
    if (accessData?.reason === 'password_required') {
      setPasswordError(true);
    }
  }, [accessData?.accessible, accessData?.reason, submittedPassword]);
  const form = accessData?.accessible ? (accessData.form ?? null) : null;
  const submitMutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (!form?.id) {
        throw new Error('Form not found');
      }
      return submitFormAction(form.id, data, { password: submittedPassword }, requestedLocale);
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({
          title: tEmbeddedForm('submission.failedTitle'),
          message: result.error,
          tone: 'danger',
        });
      } else {
        setSubmitted(true);
      }
    },
    onError: (err) => {
      notifications.show({
        title: tEmbeddedForm('submission.failedTitle'),
        message: err instanceof Error ? err.message : tEmbeddedForm('submission.unknownError'),
        tone: 'danger',
      });
    },
  });
  const builtForm = useMemo(() => {
    if (!form?.schema) {
      return null;
    }
    try {
      return buildForm(form.schema, { validationMessages });
    } catch {
      return null;
    }
  }, [form?.schema, validationMessages]);
  const phoneDefaultCountry = useMemo(
    () =>
      resolvePhoneDefaultCountryCode({
        viewerLocale: requestedLocale,
      }),
    [requestedLocale],
  );
  const handleSubmit = async (values: FormValues) => {
    if (preview) {
      return;
    }
    await submitMutation.mutateAsync(values);
  };
  const handlePasswordSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = passwordInput.trim();
    if (!password) {
      notifications.show({
        title: tEmbeddedForm('password.requiredTitle'),
        message: tEmbeddedForm('password.requiredMessage'),
        tone: 'danger',
      });
      return;
    }
    setPasswordError(false);
    setSubmittedPassword(password);
  };
  if (!formId) {
    return (
      <div className="form-block">
        <DsLayoutInset block="xl">
          <DsLayoutInset space="none">
            <DsLayoutStack gap="md">
              <SupportingText tone="secondary" align="center">
                {tEmbeddedForm('states.noFormSelected')}
              </SupportingText>
            </DsLayoutStack>
          </DsLayoutInset>
        </DsLayoutInset>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="form-block">
        <PageLoader placement="flow" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="form-block">
        <DsLayoutInset block="xl">
          <DsLayoutInset space="none">
            <DsLayoutStack gap="md">
              <FormAccessBoundary reason="server_error" slug={formId} mode="inline" />
            </DsLayoutStack>
          </DsLayoutInset>
        </DsLayoutInset>
      </div>
    );
  }
  if (!accessData?.accessible) {
    if (accessData?.reason === 'password_required') {
      return (
        <div className="form-block">
          <DsLayoutInset block="xl">
            <DsLayoutInset space="none">
              <DsLayoutStack gap="md">
                <div style={{ maxWidth: 420, marginInline: 'auto' }}>
                  <DsLayoutStack gap="md">
                    <DsHeading level={4}>{tFormAccess('passwordRequired.title')}</DsHeading>
                    <SupportingText tone="secondary">{tEmbeddedForm('password.description')}</SupportingText>
                    <form onSubmit={handlePasswordSubmit}>
                      <DsLayoutStack gap="sm">
                        <PasswordInput
                          value={passwordInput}
                          onChange={(event) => setPasswordInput(event.currentTarget.value)}
                          placeholder={tCommonPlaceholders('password')}
                          error={passwordError ? tEmbeddedForm('password.incorrect') : undefined}
                        />
                        <Button type="submit" loading={isFetching}>
                          {tCommonActions('continue')}
                        </Button>
                      </DsLayoutStack>
                    </form>
                  </DsLayoutStack>
                </div>
              </DsLayoutStack>
            </DsLayoutInset>
          </DsLayoutInset>
        </div>
      );
    }
    return (
      <div className="form-block">
        <DsLayoutInset block="xl">
          <DsLayoutInset space="none">
            <DsLayoutStack gap="md">
              <FormAccessBoundary reason={accessData?.reason ?? 'server_error'} slug={formId} mode="inline" />
            </DsLayoutStack>
          </DsLayoutInset>
        </DsLayoutInset>
      </div>
    );
  }
  if (!form) {
    return (
      <div className="form-block">
        <DsLayoutInset block="xl">
          <DsLayoutInset space="none">
            <DsLayoutStack gap="md">
              <FormAccessBoundary reason="form_not_found" slug={formId} mode="inline" />
            </DsLayoutStack>
          </DsLayoutInset>
        </DsLayoutInset>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="form-block">
        <DsLayoutInset block="xl">
          <DsLayoutStack gap="lg">
            <FormSubmissionSuccessState />
          </DsLayoutStack>
        </DsLayoutInset>
      </div>
    );
  }
  if (!builtForm) {
    return (
      <div className="form-block">
        <DsLayoutInset block="xl">
          <DsLayoutInset space="none">
            <DsLayoutStack gap="md">
              <FormAccessBoundary reason="server_error" slug={formId} mode="inline" />
            </DsLayoutStack>
          </DsLayoutInset>
        </DsLayoutInset>
      </div>
    );
  }
  return (
    <div className="form-block">
      <div style={{ position: 'relative' }} aria-busy={submitMutation.isPending}>
        <DsLayoutStack gap="md">
          {showTitle === 'true' && form.title && <DsHeading level={3}>{form.title}</DsHeading>}
          <FormRenderer form={builtForm} phoneDefaultCountry={phoneDefaultCountry} onSubmit={handleSubmit} />
        </DsLayoutStack>

        {submitMutation.isPending ? (
          <ProcessingOverlay>
            <FormSubmissionPendingState contrast="inverse" />
          </ProcessingOverlay>
        ) : null}
      </div>
    </div>
  );
}
