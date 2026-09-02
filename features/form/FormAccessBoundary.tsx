'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Box, Center, Container, Stack, Text, Title } from '@mantine/core';
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
      return <Text c="dimmed">{t('states.formNotFound')}</Text>;
    case 'not_public':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('notPublic.title')}</Title>
          <Text c="dimmed">{t('notPublic.description')}</Text>
        </Stack>
      );
    case 'password_required':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('passwordRequired.title')}</Title>
          <Text c="dimmed">{t('passwordRequired.description')}</Text>
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
        </Stack>
      );
    case 'already_submitted':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('alreadySubmitted.title')}</Title>
          <Text c="dimmed">{t('alreadySubmitted.description')}</Text>
        </Stack>
      );
    case 'not_yet_open':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('notYetOpen.title')}</Title>
          <Text c="dimmed">{t('notYetOpen.description')}</Text>
        </Stack>
      );
    case 'closed':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('closed.title')}</Title>
          <Text c="dimmed">{t('closed.description')}</Text>
        </Stack>
      );
    case 'max_submissions_reached':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('maxSubmissionsReached.title')}</Title>
          <Text c="dimmed">{t('maxSubmissionsReached.description')}</Text>
        </Stack>
      );
    case 'auth_required':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('authRequired.title')}</Title>
          <Text c="dimmed">{t('authRequired.description')}</Text>
          <Button tone="neutral" emphasis="low" onClick={() => router.push(buildLoginRedirectHref(redirectPath))}>
            {t('authRequired.action')}
          </Button>
        </Stack>
      );
    case 'role_not_allowed':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('roleNotAllowed.title')}</Title>
          <Text c="dimmed">{t('roleNotAllowed.description')}</Text>
        </Stack>
      );
    case 'server_error':
      return (
        <Stack align="center" gap="xs">
          <Title order={3}>{t('serverError.title')}</Title>
          <Text c="dimmed">{t('serverError.description')}</Text>
        </Stack>
      );
    default:
      return <Text c="dimmed">{t('states.unavailable')}</Text>;
  }
}

export function FormAccessBoundary({ reason, slug, shareToken, mode = 'page', passwordPath }: FormAccessBoundaryProps) {
  if (mode === 'inline') {
    return (
      <Box py="xl" ta="center">
        <FormAccessContent reason={reason} slug={slug} shareToken={shareToken} passwordPath={passwordPath} />
      </Box>
    );
  }

  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Container size="sm" py="xl">
        <Center>
          <FormAccessContent reason={reason} slug={slug} shareToken={shareToken} passwordPath={passwordPath} />
        </Center>
      </Container>
    </Box>
  );
}
