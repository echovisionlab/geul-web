'use client';

import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
      return submitFormAction(form.id, data, submittedPassword, requestedLocale);
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({
          title: tEmbeddedForm('submission.failedTitle'),
          message: result.error,
          color: 'red',
        });
      } else {
        setSubmitted(true);
      }
    },
    onError: (err) => {
      notifications.show({
        title: tEmbeddedForm('submission.failedTitle'),
        message: err instanceof Error ? err.message : tEmbeddedForm('submission.unknownError'),
        color: 'red',
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
        color: 'red',
      });
      return;
    }
    setPasswordError(false);
    setSubmittedPassword(password);
  };

  if (!formId) {
    return (
      <Box className="form-block" py="xl">
        <Stack gap="md">
          <Text c="dimmed" ta="center">
            {tEmbeddedForm('states.noFormSelected')}
          </Text>
        </Stack>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box className="form-block">
        <Stack gap="md">
          {showTitle === 'true' && <Skeleton height={32} width="40%" />}
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={36} width={100} />
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="form-block" py="xl">
        <Stack gap="md">
          <FormAccessBoundary reason="server_error" slug={formId} mode="inline" />
        </Stack>
      </Box>
    );
  }

  if (!accessData?.accessible) {
    if (accessData?.reason === 'password_required') {
      return (
        <Box className="form-block" py="xl">
          <Stack gap="md">
            <Stack gap="md" maw={420} mx="auto">
              <Title order={4}>{tFormAccess('passwordRequired.title')}</Title>
              <Text c="dimmed" size="sm">
                {tEmbeddedForm('password.description')}
              </Text>
              <form onSubmit={handlePasswordSubmit}>
                <Stack gap="sm">
                  <PasswordInput
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.currentTarget.value)}
                    placeholder={tCommonPlaceholders('password')}
                    error={passwordError ? tEmbeddedForm('password.incorrect') : undefined}
                  />
                  <Button type="submit" loading={isFetching}>
                    {tCommonActions('continue')}
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Stack>
        </Box>
      );
    }

    return (
      <Box className="form-block" py="xl">
        <Stack gap="md">
          <FormAccessBoundary reason={accessData?.reason ?? 'server_error'} slug={formId} mode="inline" />
        </Stack>
      </Box>
    );
  }

  if (!form) {
    return (
      <Box className="form-block" py="xl">
        <Stack gap="md">
          <FormAccessBoundary reason="form_not_found" slug={formId} mode="inline" />
        </Stack>
      </Box>
    );
  }

  if (submitted) {
    return (
      <Box className="form-block">
        <Stack gap="lg" py="xl">
          <FormSubmissionSuccessState />
        </Stack>
      </Box>
    );
  }

  if (!builtForm) {
    return (
      <Box className="form-block" py="xl">
        <Stack gap="md">
          <FormAccessBoundary reason="server_error" slug={formId} mode="inline" />
        </Stack>
      </Box>
    );
  }

  return (
    <Box className="form-block">
      <Box pos="relative" aria-busy={submitMutation.isPending}>
        <Stack gap="md">
          {showTitle === 'true' && form.title && <Title order={3}>{form.title}</Title>}
          <FormRenderer form={builtForm} phoneDefaultCountry={phoneDefaultCountry} onSubmit={handleSubmit} />
        </Stack>

        {submitMutation.isPending ? (
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.55)',
              zIndex: 1,
            }}
          >
            <FormSubmissionPendingState />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
