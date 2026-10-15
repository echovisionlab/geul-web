'use client';
import { SupportingText, Heading as DsHeading } from '@/components/core/Typography';
import { SectionCard as DsSectionCard } from '@/components/core/Section';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';

import { unwrapQueryResult } from '@/lib/api/query-result';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLock } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { PasswordInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { checkFormAccessAction, verifyFormPasswordAction } from '@/lib/actions/form';

interface FormPasswordContentProps {
  accessAction?: typeof checkFormAccessAction;
  verifyAction?: typeof verifyFormPasswordAction;
  onNavigate?: (href: string) => void;

  slug: string;
  shareToken?: string;
  next?: 'form' | 'dashboard';
  requestedLocale: string;
}

export function FormPasswordContent({
  slug,
  shareToken,
  next = 'form',
  requestedLocale,
  accessAction = checkFormAccessAction,
  verifyAction = verifyFormPasswordAction,
  onNavigate,
}: FormPasswordContentProps) {
  const t = useTranslations('formPasswordPage');
  const tCommonActions = useTranslations('common.actions');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState<string | undefined>(undefined);
  const [passwordLoaded, setPasswordLoaded] = useState(false);

  const basePath = useMemo(() => {
    const targetPath = next === 'dashboard' ? `/forms/${slug}/dashboard` : `/forms/${slug}`;
    const params = new URLSearchParams();
    if (shareToken) {
      params.set('share', shareToken);
    }
    if (requestedLocale) {
      params.set('lang', requestedLocale);
    }
    const search = params.toString();
    return search ? `${targetPath}?${search}` : targetPath;
  }, [next, requestedLocale, shareToken, slug]);

  useEffect(() => {
    const existingPassword = sessionStorage.getItem(`form-password-${slug}`) ?? undefined;
    setStoredPassword(existingPassword);
    setPasswordLoaded(true);
  }, [slug]);

  const accessQuery = useQuery({
    queryKey: ['form-password-route-access', slug, next, shareToken, storedPassword, requestedLocale],
    queryFn: () =>
      accessAction({
        slug,
        context: 'url',
        shareToken,
        password: storedPassword,
        target: next,
        requestedLocale,
      }),
    enabled: passwordLoaded,
  });

  useEffect(() => {
    if (!passwordLoaded || accessQuery.isLoading || !accessQuery.data) {
      return;
    }

    if (accessQuery.data.reason === 'password_required') {
      if (storedPassword) {
        sessionStorage.removeItem(`form-password-${slug}`);
        setStoredPassword(undefined);
      }
      return;
    }

    if (onNavigate) {
      onNavigate(basePath);
    } else {
      router.replace(basePath);
    }
  }, [accessQuery.data, accessQuery.isLoading, basePath, passwordLoaded, router, slug, storedPassword, onNavigate]);

  const verifyPassword = useMutation({
    mutationFn: (data: { slug: string; password: string }) =>
      verifyAction(data.slug, data.password, shareToken).then(unwrapQueryResult),
    onSuccess: (data) => {
      if (data.valid) {
        // Store password in session storage for this form
        sessionStorage.setItem(`form-password-${slug}`, password);
        if (onNavigate) {
          onNavigate(basePath);
        } else {
          router.replace(basePath);
        }
      } else {
        notifications.show({ message: t('errors.incorrectPassword'), tone: 'danger' });
      }
    },
  });

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      notifications.show({ message: t('errors.passwordRequired'), tone: 'danger' });
      return;
    }
    verifyPassword.mutate({ slug, password });
  };

  if (accessQuery.isError) {
    return <QueryErrorAlert queries={[accessQuery]} />;
  }

  if (!passwordLoaded || accessQuery.isLoading || accessQuery.data?.reason !== 'password_required') {
    return (
      <div style={{ minHeight: '100dvh' }}>
        <DsSectionCard padding="none" appearance="surface" border="none">
          <DsLayoutInset space="none">
            <PageLoader />
          </DsLayoutInset>
        </DsSectionCard>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh' }}>
      <DsSectionCard padding="none" appearance="surface" border="none">
        <DsLayoutInset space="none">
          <DsLayoutInset block="xl">
            <DsLayoutContainer size="compact">
              <DsLayoutStack gap="md">
                <DsLayoutInset textAlign="center" space="none">
                  <SiteLogo height={24} />
                </DsLayoutInset>

                <DsLayoutStack align="center" justify="center">
                  <DsSectionCard withBorder padding="xl">
                    <form onSubmit={handleSubmit}>
                      <DsLayoutStack gap="lg" align="center">
                        <QueryErrorAlert
                          queries={[
                            {
                              isError: verifyPassword.isError,
                              error: verifyPassword.error,
                              isFetching: verifyPassword.isPending,
                              refetch: () => verifyPassword.mutateAsync({ slug, password }),
                            },
                          ]}
                        />
                        <IconLock size={48} color="var(--geul-text-muted)" />
                        <div style={{ textAlign: 'center' }}>
                          <DsHeading level={3}>{t('title')}</DsHeading>
                          <DsLayoutInset blockStart="xs">
                            <SupportingText tone="secondary">{t('description')}</SupportingText>
                          </DsLayoutInset>
                        </div>

                        <div style={{ width: '100%' }}>
                          <PasswordInput
                            placeholder={tCommonPlaceholders('password')}
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                          />
                        </div>

                        <Button type="submit" fullWidth loading={verifyPassword.isPending}>
                          {tCommonActions('continue')}
                        </Button>
                      </DsLayoutStack>
                    </form>
                  </DsSectionCard>
                </DsLayoutStack>
              </DsLayoutStack>
            </DsLayoutContainer>
          </DsLayoutInset>
        </DsLayoutInset>
      </DsSectionCard>
    </div>
  );
}
