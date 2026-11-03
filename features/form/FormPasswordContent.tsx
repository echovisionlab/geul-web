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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLock } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { PasswordInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { SITE_LOGO_HEIGHT } from '@/features/site/SiteLogo/placements';
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

export function FormPasswordContent(props: FormPasswordContentProps) {
  return (
    <FormPasswordTarget
      key={JSON.stringify([props.slug, props.shareToken, props.next, props.requestedLocale])}
      {...props}
    />
  );
}

function FormPasswordTarget({
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
  const tCommonLabels = useTranslations('common.labels');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [navigating, setNavigating] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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

  // A password verified earlier in this browser lives in an HttpOnly cookie the server action reads.
  const accessQuery = useQuery({
    queryKey: ['form-password-route-access', slug, next, shareToken, requestedLocale],
    queryFn: () =>
      accessAction({
        slug,
        context: 'url',
        shareToken,
        target: next,
        requestedLocale,
      }),
  });

  useEffect(() => {
    if (accessQuery.isLoading || !accessQuery.data || accessQuery.data.reason === 'password_required') {
      return;
    }
    if (onNavigate) {
      onNavigate(basePath);
    } else {
      router.replace(basePath);
    }
  }, [accessQuery.data, accessQuery.isLoading, basePath, router, onNavigate]);

  const verifyPassword = useMutation({
    mutationFn: (data: { slug: string; password: string }) =>
      verifyAction(data.slug, data.password, shareToken).then(unwrapQueryResult),
    onSuccess: (data) => {
      if (!mounted.current) {
        return;
      }
      if (data.valid) {
        setNavigating(true);
        if (onNavigate) {
          onNavigate(basePath);
        } else {
          router.replace(basePath);
        }
      } else {
        notifications.show({ message: t('errors.incorrectPassword'), tone: 'danger' });
      }
    },
    onError: () => {
      if (mounted.current) {
        setNavigating(false);
      }
    },
  });

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (verifyPassword.isPending || navigating) {
      return;
    }
    if (!password.trim()) {
      notifications.show({ message: t('errors.passwordRequired'), tone: 'danger' });
      return;
    }
    verifyPassword.mutate({ slug, password });
  };

  if (accessQuery.isError) {
    return <QueryErrorAlert queries={[accessQuery]} />;
  }

  if (accessQuery.isLoading || accessQuery.data?.reason !== 'password_required') {
    return (
      <div style={{ minHeight: '100dvh' }}>
        <DsSectionCard padding="none" appearance="surface" border="none">
          <DsLayoutInset space="none">
            <PageLoader extent="viewport" placement="flow" />
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
                  <SiteLogo height={SITE_LOGO_HEIGHT.form} />
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
                            aria-label={tCommonLabels('password')}
                            placeholder={tCommonPlaceholders('password')}
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                          />
                        </div>

                        <Button type="submit" fullWidth loading={verifyPassword.isPending || navigating}>
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
