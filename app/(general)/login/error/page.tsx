import type { Metadata } from 'next';
import { IconAlertCircle, IconBan, IconLock, IconUserX } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('loginFailed', '/login/error');
}

interface AuthError {
  code?: number;
  status?: string;
  reason?: string;
  message?: string;
  id?: string;
}

interface AuthErrorResponse {
  id: string;
  error: AuthError;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  searchParams: Promise<{ id?: string }>;
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function getErrorContent(
  error: AuthError | null,
  t: Translator,
  tGeneralError: Translator,
): {
  icon: React.ReactNode;
  title: string;
  message: string;
  color: string;
  showRecovery?: boolean;
} {
  if (!error) {
    return {
      icon: <IconAlertCircle size={48} />,
      title: tGeneralError('title'),
      message: t('states.generic.message'),
      color: 'red',
    };
  }

  // Check for specific error types
  const errorId = error.id || '';
  const reason = error.reason?.toLowerCase() || '';
  const message = error.message?.toLowerCase() || '';

  // Account pending deletion - show recovery option (exact match preferred, fallback to includes)
  if (errorId === 'account_pending_deletion' || message.includes('pending deletion')) {
    return {
      icon: <IconUserX size={48} />,
      title: t('states.accountPendingDeletion.title'),
      message: t('states.accountPendingDeletion.message'),
      color: 'orange',
      showRecovery: true,
    };
  }

  // Account banned/suspended (exact match preferred, fallback to includes)
  if (
    errorId === 'account_banned' ||
    reason.includes('banned') ||
    reason.includes('suspended') ||
    reason.includes('inactive') ||
    message.includes('account has been suspended')
  ) {
    return {
      icon: <IconBan size={48} />,
      title: t('states.accountSuspended.title'),
      message: t('states.accountSuspended.message'),
      color: 'red',
    };
  }

  // Session/auth issues
  if (
    errorId === 'session_inactive' ||
    errorId === 'session_aal1_required' ||
    errorId === 'session_already_available'
  ) {
    return {
      icon: <IconLock size={48} />,
      title: t('states.sessionError.title'),
      message: t('states.sessionError.message'),
      color: 'orange',
    };
  }

  // CSRF violation
  if (errorId === 'security_csrf_violation') {
    return {
      icon: <IconAlertCircle size={48} />,
      title: t('states.securityError.title'),
      message: t('states.securityError.message'),
      color: 'red',
    };
  }

  // Generic error with message
  return {
    icon: <IconAlertCircle size={48} />,
    title: t('states.loginFailed.title'),
    message: t('states.loginFailed.message'),
    color: 'red',
  };
}

export default async function LoginFailedPage({ searchParams }: Props) {
  const [t, tCommonActions, tGeneralError] = await Promise.all([
    getTranslations('auth.loginFailed'),
    getTranslations('common.actions'),
    getTranslations('generalError'),
  ]);
  const { id: errorId } = await searchParams;

  const errorData: AuthErrorResponse | null = errorId ? { id: errorId, error: { id: errorId } } : null;

  const { icon, title, message, color, showRecovery } = getErrorContent(errorData?.error || null, t, tGeneralError);

  return (
    <Center style={{ flex: 1 }} p="md">
      <Paper radius="md" p="xl" withBorder maw={450} w="100%">
        <Stack align="center" gap="lg">
          <Text c={color}>{icon}</Text>

          <Title order={2} ta="center">
            {title}
          </Title>

          <Text c="dimmed" ta="center" size="sm">
            {message}
          </Text>

          <Stack gap="sm" w="100%">
            {showRecovery && (
              <Button component="a" href="/account/recover" fullWidth>
                {tCommonActions('recoverAccount')}
              </Button>
            )}
            <Button component="a" href="/login" fullWidth emphasis={showRecovery ? 'medium' : 'strong'}>
              {tCommonActions('backToLogin')}
            </Button>

            <Button component="a" href="/" emphasis="low" fullWidth>
              {t('actions.goHome')}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Center>
  );
}
