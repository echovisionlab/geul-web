'use client';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import {
  LayoutStack as DsLayoutStack,
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/core/Button';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { AccessReason } from '@/lib/types/form/model';

type FormAccessBoundaryReason = AccessReason | 'server_error';

interface FormAccessBoundaryProps {
  reason?: FormAccessBoundaryReason;
  slug: string;
  shareToken?: string;
  mode?: 'page' | 'inline';
  passwordPath?: string;
}

function FormAccessContent({ reason, slug, shareToken, passwordPath }: FormAccessBoundaryProps) {
  const t = useTranslations('formAccess');
  const router = useRouter();
  const currentLang = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
  const redirectPath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : shareToken
        ? `/forms/${slug}?share=${encodeURIComponent(shareToken)}`
        : `/forms/${slug}`;

  switch (reason) {
    case 'form_not_found':
    case 'form_not_published':
      return (
        <DsText size="sm" tone="secondary">
          {t('states.formNotFound')}
        </DsText>
      );
    case 'not_public':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('notPublic.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('notPublic.description')}
          </DsText>
        </DsLayoutStack>
      );
    case 'password_required':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('passwordRequired.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('passwordRequired.description')}
          </DsText>
          <Button
            tone="neutral"
            emphasis="low"
            onClick={() => {
              if (passwordPath) {
                router.push(passwordPath);
                return;
              }
              const params = new URLSearchParams();
              if (shareToken) {
                params.set('share', shareToken);
              }
              if (currentLang) {
                params.set('lang', currentLang);
              }
              const search = params.toString();
              router.push(search ? `/forms/${slug}/password?${search}` : `/forms/${slug}/password`);
            }}
          >
            {t('passwordRequired.action')}
          </Button>
        </DsLayoutStack>
      );
    case 'already_submitted':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('alreadySubmitted.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('alreadySubmitted.description')}
          </DsText>
        </DsLayoutStack>
      );
    case 'not_yet_open':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('notYetOpen.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('notYetOpen.description')}
          </DsText>
        </DsLayoutStack>
      );
    case 'closed':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('closed.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('closed.description')}
          </DsText>
        </DsLayoutStack>
      );
    case 'max_submissions_reached':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('maxSubmissionsReached.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('maxSubmissionsReached.description')}
          </DsText>
        </DsLayoutStack>
      );
    case 'auth_required':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('authRequired.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('authRequired.description')}
          </DsText>
          <Button tone="neutral" emphasis="low" onClick={() => router.push(buildLoginRedirectHref(redirectPath))}>
            {t('authRequired.action')}
          </Button>
        </DsLayoutStack>
      );
    case 'role_not_allowed':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('roleNotAllowed.title')}</DsHeading>
          <DsText size="sm" tone="secondary">
            {t('roleNotAllowed.description')}
          </DsText>
        </DsLayoutStack>
      );
    case 'server_error':
      return (
        <DsLayoutStack align="center" gap="xs">
          <DsHeading level={3}>{t('serverError.title')}</DsHeading>
          <DsText size="sm" tone="danger">
            {t('serverError.description')}
          </DsText>
        </DsLayoutStack>
      );
    default:
      return (
        <DsText size="sm" tone="secondary">
          {t('states.unavailable')}
        </DsText>
      );
  }
}

export function FormAccessBoundary({ reason, slug, shareToken, mode = 'page', passwordPath }: FormAccessBoundaryProps) {
  if (mode === 'inline') {
    return (
      <DsLayoutInset block="xl">
        <DsLayoutInset textAlign="center" space="none">
          <FormAccessContent reason={reason} slug={slug} shareToken={shareToken} passwordPath={passwordPath} />
        </DsLayoutInset>
      </DsLayoutInset>
    );
  }

  return (
    <div style={{ minHeight: '100dvh' }}>
      <DsSectionCard padding="none" appearance="surface" border="none">
        <DsLayoutInset space="none">
          <DsLayoutInset block="xl">
            <DsLayoutContainer size="compact">
              <DsLayoutStack align="center" justify="center">
                <FormAccessContent reason={reason} slug={slug} shareToken={shareToken} passwordPath={passwordPath} />
              </DsLayoutStack>
            </DsLayoutContainer>
          </DsLayoutInset>
        </DsLayoutInset>
      </DsSectionCard>
    </div>
  );
}
