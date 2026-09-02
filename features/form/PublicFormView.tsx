'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconEyeOff } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Container, Paper, Stack, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { notifications } from '@mantine/notifications';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { FormAccessBoundary } from '@/features/form/FormAccessBoundary';
import { FormRenderer } from '@/features/form/FormRenderer';
import { FormSubmissionPendingState } from '@/features/form/FormSubmissionState';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { resolvePhoneDefaultCountryCode } from '@/features/form/phone-default-country';
import { useFormValidationMessages } from '@/features/form/useFormValidationMessages';
import {
  checkFormAccessAction,
  submitFormAction,
  verifyFormPasswordAction,
  type FormAccessData,
  type PublicFormData,
} from '@/lib/actions/form';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { buildForm } from '@/lib/form/build';
import { resolveSiteHref } from '@/lib/utils/site-url';

interface PublicFormViewProps {
  slug: string;
  form: PublicFormData | null;
  accessData: FormAccessData | null;
  requestedLocale: string;
  viewerCountryCode?: string | null;
  previewShareToken?: string;
  previewSharePassword?: string;
}

export function PublicFormView({
  slug,
  form: initialForm,
  accessData,
  requestedLocale,
  viewerCountryCode,
  previewShareToken,
  previewSharePassword,
}: PublicFormViewProps) {
  const t = useTranslations('publicForm');
  const validationMessages = useFormValidationMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSiteSettings();

  const shareToken = previewShareToken ?? searchParams.get('share') ?? '';
  const isShareMode = !!shareToken;
  const accessReason = accessData?.reason;
  const logoHref = resolveSiteHref(settings.site_origin);
  const logoHeader = (
    <a href={logoHref} aria-label={t('logoLinkAria')} style={{ display: 'inline-flex' }}>
      <SiteLogo height={16} />
    </a>
  );

  const renderWithHeader = (content: ReactNode) => (
    <Box mih="100dvh" bg="var(--mantine-color-body)" style={{ display: 'flex', flexDirection: 'column' }}>
      <Box component="header" px="xl" py="md">
        {logoHeader}
      </Box>
      <Box component="main" px="xl" pb="xl" style={{ flex: 1 }}>
        <Container size="md" px={0}>
          {content}
        </Container>
      </Box>
    </Box>
  );

  const [passwordVerified, setPasswordVerified] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(accessReason === 'password_required');
  const [redirectingToSuccess, setRedirectingToSuccess] = useState(false);
  const passwordPath = useMemo(() => {
    const params = new URLSearchParams();
    if (isShareMode && shareToken) {
      params.set('share', shareToken);
    }
    if (requestedLocale) {
      params.set('lang', requestedLocale);
    }
    const search = params.toString();
    return search ? `/forms/${slug}/password?${search}` : `/forms/${slug}/password`;
  }, [isShareMode, requestedLocale, shareToken, slug]);
  const successPath = useMemo(() => {
    const params = new URLSearchParams();
    if (requestedLocale) {
      params.set('lang', requestedLocale);
    }
    const search = params.toString();
    return search ? `/forms/${slug}/success?${search}` : `/forms/${slug}/success`;
  }, [requestedLocale, slug]);

  useEffect(() => {
    if (accessReason !== 'password_required') {
      setCheckingPassword(false);
      setPasswordVerified(false);
      return;
    }

    const storedPassword = sessionStorage.getItem(`form-password-${slug}`);
    if (!storedPassword) {
      setCheckingPassword(false);
      setPasswordVerified(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const result = await verifyFormPasswordAction(slug, storedPassword, isShareMode ? shareToken : undefined);
        if (cancelled) {
          return;
        }
        setPasswordVerified(result.valid);
        if (!result.valid) {
          sessionStorage.removeItem(`form-password-${slug}`);
        }
      } catch {
        if (!cancelled) {
          setPasswordVerified(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingPassword(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [accessReason, isShareMode, shareToken, slug]);

  const needsProtectedFetch = accessReason === 'password_required' && passwordVerified;
  const { data: protectedAccess, isLoading: protectedAccessLoading } = useQuery({
    queryKey: ['form-access', slug, shareToken, passwordVerified, requestedLocale],
    queryFn: async () => {
      const storedPassword = sessionStorage.getItem(`form-password-${slug}`) ?? undefined;
      return checkFormAccessAction({
        slug,
        context: 'url',
        shareToken: isShareMode ? shareToken : undefined,
        sharePassword: previewSharePassword,
        password: storedPassword,
        requestedLocale,
      });
    },
    enabled: needsProtectedFetch,
  });

  const form = initialForm ?? (protectedAccess?.accessible && protectedAccess.form ? protectedAccess.form : null);
  const contentPathname = isShareMode ? `/s/${shareToken}` : `/forms/${slug}`;
  const contentQuery = Object.fromEntries(searchParams.entries());
  const localizationControls = form?.localizationInfo ? (
    <Stack gap="sm">
      <LocalizationNotice
        pathname={contentPathname}
        query={contentQuery}
        requestedLocale={requestedLocale}
        localizationInfo={form.localizationInfo}
      />
      <Box className="print-hide" style={{ alignSelf: 'flex-end' }}>
        <ContentLanguageMenu
          pathname={contentPathname}
          query={contentQuery}
          requestedLocale={requestedLocale}
          localizationInfo={form.localizationInfo}
        />
      </Box>
    </Stack>
  ) : null;

  const builtForm = useMemo(() => {
    if (!form) {
      return null;
    }
    try {
      return buildForm(form.schema, { validationMessages });
    } catch {
      return null;
    }
  }, [form, validationMessages]);
  const phoneDefaultCountry = useMemo(
    () =>
      resolvePhoneDefaultCountryCode({
        viewerCountryCode,
        viewerLocale: requestedLocale,
      }),
    [requestedLocale, viewerCountryCode],
  );

  const submitForm = useMutation({
    mutationFn: (data: { formId: string; data: Record<string, unknown>; password?: string }) =>
      submitFormAction(data.formId, data.data, data.password, requestedLocale),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setRedirectingToSuccess(true);
      router.push(successPath);
    },
  });

  const isLoading = checkingPassword || (needsProtectedFetch && protectedAccessLoading);
  if (isLoading) {
    return (
      <Box mih="100dvh" bg="var(--mantine-color-body)">
        <PageLoader />
      </Box>
    );
  }

  if (!form) {
    return renderWithHeader(
      <FormAccessBoundary
        reason={protectedAccess?.reason ?? accessReason ?? 'form_not_found'}
        slug={slug}
        shareToken={isShareMode ? shareToken : undefined}
        mode="inline"
        passwordPath={passwordPath}
      />,
    );
  }

  if (!builtForm) {
    return renderWithHeader(
      <FormAccessBoundary reason="server_error" slug={slug} shareToken={shareToken} mode="inline" />,
    );
  }

  if (isShareMode) {
    return renderWithHeader(
      <Stack gap="md">
        {localizationControls}
        <Alert tone="warning" icon={<IconEyeOff size={16} />} title={t('previewMode.title')}>
          {t('previewMode.description')}
        </Alert>

        <Paper p="xl">
          <Stack gap="lg">
            <Title order={2}>{form.title}</Title>
            <FormRenderer form={builtForm} previewMode phoneDefaultCountry={phoneDefaultCountry} />
          </Stack>
        </Paper>
      </Stack>,
    );
  }

  return renderWithHeader(
    <Stack gap="md">
      {localizationControls}
      <Paper p="xl">
        <Box pos="relative" aria-busy={submitForm.isPending || redirectingToSuccess}>
          <Stack gap="lg">
            <Title order={2}>{form.title}</Title>

            <FormRenderer
              form={builtForm}
              phoneDefaultCountry={phoneDefaultCountry}
              onSubmit={async (values) => {
                const password = sessionStorage.getItem(`form-password-${slug}`) ?? undefined;
                await submitForm.mutateAsync({
                  formId: form.id,
                  data: values,
                  password,
                });
              }}
            />
          </Stack>

          {submitForm.isPending || redirectingToSuccess ? (
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
              <FormSubmissionPendingState minHeight={320} />
            </Box>
          ) : null}
        </Box>
      </Paper>
    </Stack>,
  );
}
