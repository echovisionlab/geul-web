import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ErrorPageAction } from '@/components/core/ErrorPage/ErrorPageView';
import { ErrorPageView } from '@/features/application-error/ErrorPageView';
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
  status: number;
  title: string;
  message: string;
  showRecovery?: boolean;
} {
  if (!error) {
    return {
      status: 500,
      title: tGeneralError('title'),
      message: t('states.generic.message'),
    };
  }

  // Check for specific error types
  const errorId = error.id || '';
  const reason = error.reason?.toLowerCase() || '';
  const message = error.message?.toLowerCase() || '';

  // Account pending deletion - show recovery option (exact match preferred, fallback to includes)
  if (errorId === 'account_pending_deletion' || message.includes('pending deletion')) {
    return {
      status: 403,
      title: t('states.accountPendingDeletion.title'),
      message: t('states.accountPendingDeletion.message'),
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
      status: 403,
      title: t('states.accountSuspended.title'),
      message: t('states.accountSuspended.message'),
    };
  }

  // Session/auth issues
  if (
    errorId === 'session_inactive' ||
    errorId === 'session_aal1_required' ||
    errorId === 'session_already_available'
  ) {
    return {
      status: 401,
      title: t('states.sessionError.title'),
      message: t('states.sessionError.message'),
    };
  }

  // CSRF violation
  if (errorId === 'security_csrf_violation') {
    return {
      status: 403,
      title: t('states.securityError.title'),
      message: t('states.securityError.message'),
    };
  }

  // Generic error with message
  return {
    status: error.code && error.code >= 400 && error.code <= 599 ? error.code : 401,
    title: t('states.loginFailed.title'),
    message: t('states.loginFailed.message'),
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

  const { status, title, message, showRecovery } = getErrorContent(errorData?.error || null, t, tGeneralError);
  const actions: ErrorPageAction[] = [];
  if (showRecovery) {
    actions.push({ label: tCommonActions('recoverAccount'), href: '/account/recover' });
  }
  actions.push({ label: tCommonActions('backToLogin'), href: '/login' }, { label: t('actions.goHome'), href: '/' });
  return <ErrorPageView code={String(status)} title={title} description={message} actions={actions} />;
}
