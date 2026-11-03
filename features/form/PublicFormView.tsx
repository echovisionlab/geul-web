'use client';
import { SectionCard as DsSectionCard } from '@/components/core/Section';
import Link from '@/components/core/Navigation';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutContainer as DsLayoutContainer,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Heading as DsHeading } from '@/components/core/Typography';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconEyeOff } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { notifications } from '@/components/core/Notification';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { SITE_LOGO_HEIGHT } from '@/features/site/SiteLogo/placements';
import { FormAccessBoundary } from '@/features/form/FormAccessBoundary';
import { FormRenderer } from '@/features/form/FormRenderer';
import { FormSubmissionPendingState } from '@/features/form/FormSubmissionState';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
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
export interface PublicFormBindings {
  checkFormAccessAction: typeof checkFormAccessAction;
  submitFormAction: typeof submitFormAction;
  verifyFormPasswordAction: typeof verifyFormPasswordAction;
}
const defaultBindings: PublicFormBindings = { checkFormAccessAction, submitFormAction, verifyFormPasswordAction };
interface PublicFormViewProps {
  slug: string;
  form: PublicFormData | null;
  accessData: FormAccessData | null;
  requestedLocale: string;
  viewerCountryCode?: string | null;
  previewShareToken?: string;
  previewSharePassword?: string;
  bindings?: PublicFormBindings;
  navigate?: (href: string) => void;
}
export function PublicFormView({
  slug,
  form: initialForm,
  accessData,
  requestedLocale,
  viewerCountryCode,
  previewShareToken,
  previewSharePassword,
  bindings = defaultBindings,
  navigate,
}: PublicFormViewProps) {
  const t = useTranslations('publicForm');
  const validationMessages = useFormValidationMessages();
  const tCommonErrors = useTranslations('common.errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSiteSettings();
  const shareToken = previewShareToken ?? searchParams.get('share') ?? '';
  const isShareMode = !!shareToken;
  const accessReason = accessData?.reason;
  const logoHref = resolveSiteHref(settings.site_origin);
  const logoHeader = (
    <Link href={logoHref} appearance="graphic" aria-label={t('logoLinkAria')}>
      <SiteLogo height={SITE_LOGO_HEIGHT.form} />
    </Link>
  );
  const renderWithHeader = (content: ReactNode) => (
    <div style={{ minHeight: '100dvh' }}>
      <DsSectionCard padding="none" appearance="surface" border="none">
        <DsLayoutStack>
          <DsLayoutInset inline={{ base: 'md', md: 'xl' }} block="md">
            <DsLayoutInset space="none" as="header">
              {logoHeader}
            </DsLayoutInset>
          </DsLayoutInset>
          <DsLayoutInset inline={{ base: 'md', md: 'xl' }} blockEnd="xl">
            <DsLayoutInset flexible as="main" space="none">
              <DsLayoutContainer size="standard">{content}</DsLayoutContainer>
            </DsLayoutInset>
          </DsLayoutInset>
        </DsLayoutStack>
      </DsSectionCard>
    </div>
  );
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(accessReason === 'password_required');
  const [passwordCheckError, setPasswordCheckError] = useState<unknown>(null);
  const [passwordCheckAttempt, setPasswordCheckAttempt] = useState(0);
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
    setCheckingPassword(true);
    const run = async () => {
      try {
        const result = await bindings
          .verifyFormPasswordAction(slug, storedPassword, isShareMode ? shareToken : undefined)
          .then(unwrapQueryResult);
        if (cancelled) {
          return;
        }
        setPasswordVerified(result.valid);
        setPasswordCheckError(null);
        if (!result.valid) {
          sessionStorage.removeItem(`form-password-${slug}`);
        }
      } catch (error) {
        if (!cancelled) {
          setPasswordVerified(false);
          setPasswordCheckError(error);
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
  }, [accessReason, isShareMode, shareToken, slug, passwordCheckAttempt]);
  const needsProtectedFetch = accessReason === 'password_required' && passwordVerified;
  const protectedAccessQuery = useQuery({
    queryKey: ['form-access', slug, shareToken, passwordVerified, requestedLocale],
    queryFn: async () => {
      const storedPassword = sessionStorage.getItem(`form-password-${slug}`) ?? undefined;
      return bindings.checkFormAccessAction({
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
  const { data: protectedAccess, isLoading: protectedAccessLoading } = protectedAccessQuery;
  const form = initialForm ?? (protectedAccess?.accessible && protectedAccess.form ? protectedAccess.form : null);
  const contentPathname = isShareMode ? `/s/${shareToken}` : `/forms/${slug}`;
  const contentQuery = Object.fromEntries(searchParams.entries());
  const languageControl = form?.localizationInfo ? (
    <div className="print-hide" style={{ alignSelf: 'flex-end' }}>
      <DsLayoutInset space="none">
        <ContentLanguageMenu
          pathname={contentPathname}
          query={contentQuery}
          requestedLocale={requestedLocale}
          localizationInfo={form.localizationInfo}
        />
      </DsLayoutInset>
    </div>
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
      bindings.submitFormAction(data.formId, data.data, data.password, requestedLocale),
    onError: () => {
      notifications.show({ message: tCommonErrors('generic'), tone: 'danger' });
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setRedirectingToSuccess(true);
      (navigate ?? router.push)(successPath);
    },
  });
  const isLoading = checkingPassword || (needsProtectedFetch && protectedAccessLoading);
  if (passwordCheckError !== null || protectedAccessQuery.isError) {
    return renderWithHeader(
      <QueryErrorAlert
        queries={[
          protectedAccessQuery,
          {
            isError: passwordCheckError !== null,
            error: passwordCheckError,
            isFetching: checkingPassword,
            refetch: async () => {
              setPasswordCheckAttempt((attempt) => attempt + 1);
            },
          },
        ]}
      />,
    );
  }
  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh' }}>
        <DsSectionCard padding="none" appearance="surface" border="none">
          <DsLayoutInset space="none">
            <PageLoader placement="flow" minHeight="100dvh" />
          </DsLayoutInset>
        </DsSectionCard>
      </div>
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
      <DsLayoutStack gap="md">
        {languageControl}
        <Alert tone="warning" icon={<IconEyeOff size={16} />} title={t('previewMode.title')}>
          {t('previewMode.description')}
        </Alert>

        <DsSectionCard padding="md">
          <DsLayoutStack gap="lg">
            <DsHeading level={2} aria-level={1}>
              {form.title}
            </DsHeading>
            <FormRenderer form={builtForm} previewMode phoneDefaultCountry={phoneDefaultCountry} />
          </DsLayoutStack>
        </DsSectionCard>
      </DsLayoutStack>,
    );
  }
  return renderWithHeader(
    <DsLayoutStack gap="md">
      {languageControl}
      <DsSectionCard padding="md">
        <div style={{ position: 'relative' }} aria-busy={submitForm.isPending || redirectingToSuccess}>
          <DsLayoutStack gap="lg">
            <DsHeading level={2} aria-level={1}>
              {form.title}
            </DsHeading>

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
          </DsLayoutStack>

          {submitForm.isPending || redirectingToSuccess ? (
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <DsSectionCard padding="none" appearance="overlay" border="none">
                <DsLayoutInline align="center" justify="center">
                  <FormSubmissionPendingState minHeight={320} contrast="inverse" />
                </DsLayoutInline>
              </DsSectionCard>
            </div>
          ) : null}
        </div>
      </DsSectionCard>
    </DsLayoutStack>,
  );
}
