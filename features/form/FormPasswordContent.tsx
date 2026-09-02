'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLock } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Center, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { PasswordInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { checkFormAccessAction, verifyFormPasswordAction } from '@/lib/actions/form';

interface FormPasswordContentProps {
  slug: string;
  shareToken?: string;
  next?: 'form' | 'dashboard';
  requestedLocale: string;
}

export function FormPasswordContent({ slug, shareToken, next = 'form', requestedLocale }: FormPasswordContentProps) {
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
      checkFormAccessAction({
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

    router.replace(basePath);
  }, [accessQuery.data, accessQuery.isLoading, basePath, passwordLoaded, router, slug, storedPassword]);

  const verifyPassword = useMutation({
    mutationFn: (data: { slug: string; password: string }) =>
      verifyFormPasswordAction(data.slug, data.password, shareToken),
    onSuccess: (data) => {
      if (data.valid) {
        // Store password in session storage for this form
        sessionStorage.setItem(`form-password-${slug}`, password);
        router.replace(basePath);
      } else {
        notifications.show({ message: t('errors.incorrectPassword'), color: 'red' });
      }
    },
  });

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      notifications.show({ message: t('errors.passwordRequired'), color: 'red' });
      return;
    }
    verifyPassword.mutate({ slug, password });
  };

  if (!passwordLoaded || accessQuery.isLoading || accessQuery.data?.reason !== 'password_required') {
    return (
      <Box mih="100dvh" bg="var(--mantine-color-body)">
        <PageLoader />
      </Box>
    );
  }

  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Container size="xs" py="xl">
        <Stack gap="md">
          <Box ta="center">
            <SiteLogo height={24} />
          </Box>

          <Center>
            <Paper p="xl" withBorder w="100%">
              <form onSubmit={handleSubmit}>
                <Stack gap="lg" align="center">
                  <IconLock size={48} color="var(--mantine-color-dimmed)" />
                  <div style={{ textAlign: 'center' }}>
                    <Title order={3}>{t('title')}</Title>
                    <Text size="sm" c="dimmed" mt="xs">
                      {t('description')}
                    </Text>
                  </div>

                  <PasswordInput
                    placeholder={tCommonPlaceholders('password')}
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    style={{ width: '100%' }}
                  />

                  <Button type="submit" fullWidth loading={verifyPassword.isPending}>
                    {tCommonActions('continue')}
                  </Button>
                </Stack>
              </form>
            </Paper>
          </Center>
        </Stack>
      </Container>
    </Box>
  );
}
