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
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconEyeOff } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { notifications } from '@/components/core/Notification';
import { SiteLogo } from '@/features/site/SiteLogo';
import { SITE_LOGO_HEIGHT } from '@/features/site/SiteLogo/placements';
import { FormAccessBoundary } from '@/features/form/FormAccessBoundary';
import { FormRenderer } from '@/features/form/FormRenderer';
import { FormSubmissionPendingState } from '@/features/form/FormSubmissionState';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { resolvePhoneDefaultCountryCode } from '@/features/form/phone-default-country';
import { useFormValidationMessages } from '@/features/form/useFormValidationMessages';
import { submitFormAction, type FormAccessData, type PublicFormData } from '@/lib/actions/form';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { buildForm } from '@/lib/form/build';
import { resolveSiteHref } from '@/lib/utils/site-url';
export interface PublicFormBindings {
  submitFormAction: typeof submitFormAction;
}
const defaultBindings: PublicFormBindings = { submitFormAction };
interface PublicFormViewProps {
  slug: string;
  form: PublicFormData | null;
  accessData: FormAccessData | null;
  requestedLocale: string;
  viewerCountryCode?: string | null;
  previewShareToken?: string;
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
  // A verified Form password reaches the server render through its HttpOnly cookie.
  const form = initialForm;
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
    mutationFn: (data: { formId: string; data: Record<string, unknown> }) =>
      bindings.submitFormAction(data.formId, data.data, { slug }, requestedLocale),
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
  if (!form) {
    return renderWithHeader(
      <FormAccessBoundary
        reason={accessReason ?? 'form_not_found'}
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
                await submitForm.mutateAsync({ formId: form.id, data: values });
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
